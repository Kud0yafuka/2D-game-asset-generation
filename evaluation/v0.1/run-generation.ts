import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'csv-parse/sync'
import sharp from 'sharp'
import type { GameAsset, GenerateAssetsResponse } from '../../src/types'
import type { EvaluationCase } from './cases'
import { inspectFrame, type FrameInspection } from './lib/image-checks'
import { appendJsonLine, readJsonLines } from './lib/records'

const BASE_URL = 'https://spritecraft-studio.onrender.com'
const MAX_IMAGES = 120
const MAX_PROVIDER_FRAMES = 4
const REQUEST_TIMEOUT_MS = 240_000
const PRICE_UPPER_CNY_PER_IMAGE = 0.25
const evaluationDir = dirname(fileURLToPath(import.meta.url))
const casesPath = resolve(evaluationDir, 'test-cases.csv')
const recordsPath = resolve(evaluationDir, 'runs.jsonl')
const outputsDir = resolve(evaluationDir, 'outputs')

export interface HardChecks {
  generation_success: boolean
  category_correct: boolean
  frame_count_correct: boolean
  output_size_correct: boolean
  transparent_correct: boolean
  non_blank: boolean
  no_unparseable_frames: boolean
}

export interface GenerationRunRecord {
  run_id: string
  case_id: string
  attempt: number
  mode: 'smoke' | 'baseline'
  status: 'success' | 'failed'
  started_at: string
  completed_at: string
  duration_ms: number
  endpoint: string
  model: string
  http_status?: number
  error_type?: 'network' | 'http' | 'processing'
  error_message?: string
  retryable: boolean
  budget_frames_reserved: number
  estimated_cost_upper_cny: number
  params: EvaluationCase
  structured_prompt?: string
  asset_id?: string
  actual_frame_count?: number
  output_paths?: {
    original: string[]
    target: string[]
  }
  inspections?: FrameInspection[]
  hard_checks?: HardChecks
  hard_pass?: boolean
}

interface ApiHealth {
  model?: string
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

class NetworkError extends Error {}

export function shouldRetry(
  status: number | undefined,
  attempt: number,
  networkError = false,
  errorMessage = '',
) {
  if (/overdue balance|欠费|insufficient (?:balance|quota)|quota (?:exceeded|exhausted)/i.test(errorMessage)) return false
  return attempt === 1 && (networkError || status === 429 || (status !== undefined && status >= 500))
}

export function wouldExceedBudget(currentImages: number, requestedFrames: number, maxImages = MAX_IMAGES) {
  return currentImages + Math.min(Math.max(requestedFrames, 1), MAX_PROVIDER_FRAMES) > maxImages
}

function providerFrameBudget(frameCount: number) {
  return Math.min(Math.max(frameCount, 1), MAX_PROVIDER_FRAMES)
}

function parseBoolean(value: unknown) {
  return value === true || value === 'true' || value === '1'
}

async function readCases(): Promise<EvaluationCase[]> {
  const rows = parse(await readFile(casesPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>

  return rows.map((row) => ({
    case_id: row.case_id,
    category: row.category as EvaluationCase['category'],
    style: row.style as EvaluationCase['style'],
    complexity: row.complexity as EvaluationCase['complexity'],
    prompt_raw: row.prompt_raw,
    size: row.size as EvaluationCase['size'],
    frame_count: Number(row.frame_count),
    palette: row.palette as EvaluationCase['palette'],
    seed: row.seed,
    transparent: parseBoolean(row.transparent),
    style_lock: parseBoolean(row.style_lock),
  }))
}

function selectCases(cases: EvaluationCase[], mode: 'smoke' | 'baseline') {
  if (mode === 'baseline') return cases
  const selected = new Map<EvaluationCase['category'], EvaluationCase>()
  for (const caseItem of cases) {
    if (!selected.has(caseItem.category)) selected.set(caseItem.category, caseItem)
  }
  return [...selected.values()]
}

async function fetchHealth(): Promise<ApiHealth> {
  const response = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`Health endpoint returned HTTP ${response.status}`)
  return response.json() as Promise<ApiHealth>
}

function dataUrlParts(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Returned frame is not a base64 data URL')
  const mimeType = match[1]
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  return { buffer: Buffer.from(match[2], 'base64'), extension }
}

async function persistFrames(caseItem: EvaluationCase, runId: string, asset: GameAsset) {
  const caseDir = resolve(outputsDir, caseItem.case_id)
  await mkdir(caseDir, { recursive: true })
  const [targetWidth, targetHeight] = caseItem.size.split('x').map(Number)
  const originals: string[] = []
  const targets: string[] = []
  const inspections: FrameInspection[] = []

  for (const [index, dataUrl] of asset.frames.entries()) {
    const { buffer, extension } = dataUrlParts(dataUrl)
    const originalPath = resolve(caseDir, `${runId}-original-${index + 1}.${extension}`)
    const targetPath = resolve(caseDir, `${runId}-target-${index + 1}.png`)
    await writeFile(originalPath, buffer)
    await sharp(buffer)
      .resize(targetWidth, targetHeight, { fit: 'fill', kernel: sharp.kernel.nearest })
      .png()
      .toFile(targetPath)
    originals.push(relative(evaluationDir, originalPath))
    targets.push(relative(evaluationDir, targetPath))
    inspections.push(await inspectFrame(targetPath, caseItem.size, caseItem.transparent))
  }

  return { originals, targets, inspections }
}

function hardChecks(caseItem: EvaluationCase, asset: GameAsset, inspections: FrameInspection[]): HardChecks {
  return {
    generation_success: true,
    category_correct: asset.categoryId === caseItem.category,
    frame_count_correct: asset.frames.length === caseItem.frame_count,
    output_size_correct: inspections.length > 0 && inspections.every((item) => item.dimensions_correct),
    transparent_correct: inspections.length > 0 && inspections.every((item) => item.transparent_requirement_pass),
    non_blank: inspections.length > 0 && inspections.every((item) => !item.blank),
    no_unparseable_frames: inspections.length === asset.frames.length,
  }
}

function isTerminal(records: GenerationRunRecord[], caseId: string) {
  const attempts = records.filter((record) => record.case_id === caseId)
  if (attempts.some((record) => record.status === 'success')) return true
  const last = attempts.at(-1)
  return Boolean(
    last &&
      (!last.retryable ||
        last.attempt >= 2 ||
        /overdue balance|欠费|insufficient (?:balance|quota)|quota (?:exceeded|exhausted)/i.test(last.error_message ?? '')),
  )
}

async function requestGeneration(caseItem: EvaluationCase) {
  let response: Response
  try {
    response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        params: {
          categoryId: caseItem.category,
          prompt: caseItem.prompt_raw,
          styleId: caseItem.style,
          size: caseItem.size,
          frameCount: caseItem.frame_count,
          paletteId: caseItem.palette,
          seed: caseItem.seed,
          transparent: caseItem.transparent,
          styleLock: caseItem.style_lock,
        },
        lockedAsset: undefined,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    throw new NetworkError(error instanceof Error ? error.message : String(error))
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new HttpError(response.status, body?.message ?? `Generation returned HTTP ${response.status}`)
  }
  return { status: response.status, payload: (await response.json()) as GenerateAssetsResponse }
}

function modeFromArguments(): 'smoke' | 'baseline' {
  const modeIndex = process.argv.indexOf('--mode')
  return process.argv[modeIndex + 1] === 'smoke' ? 'smoke' : 'baseline'
}

export async function runGeneration(mode = modeFromArguments()) {
  const allCases = await readCases()
  const cases = selectCases(allCases, mode)
  const records = await readJsonLines<GenerationRunRecord>(recordsPath)
  const health = await fetchHealth().catch((error) => {
    console.warn(`Health check unavailable: ${(error as Error).message}`)
    return { model: 'unknown' }
  })
  let reservedImages = records.reduce((sum, record) => {
    if (record.status === 'success') return sum + (record.actual_frame_count ?? 0)
    return sum + (record.error_type === 'http' ? 0 : (record.budget_frames_reserved ?? 0))
  }, 0)

  console.info(`Starting ${mode} run: ${cases.length} selected cases, ${reservedImages}/${MAX_IMAGES} images already reserved`)

  for (const [caseIndex, caseItem] of cases.entries()) {
    if (isTerminal(records, caseItem.case_id)) {
      console.info(`[${caseIndex + 1}/${cases.length}] ${caseItem.case_id} already terminal; skipping`)
      continue
    }

    const priorAttempts = records.filter((record) => record.case_id === caseItem.case_id).length
    for (let attempt = priorAttempts + 1; attempt <= 2; attempt += 1) {
      if (wouldExceedBudget(reservedImages, caseItem.frame_count, MAX_IMAGES)) {
        console.warn(`Budget stop before ${caseItem.case_id}: ${reservedImages}/${MAX_IMAGES} images reserved`)
        return
      }

      const budgetFrames = providerFrameBudget(caseItem.frame_count)
      reservedImages += budgetFrames
      const started = Date.now()
      const startedAt = new Date(started).toISOString()
      const runId = `${caseItem.case_id}-${started}-a${attempt}`
      console.info(`[${caseIndex + 1}/${cases.length}] ${caseItem.case_id} attempt ${attempt}, reserving ${budgetFrames} image(s)`)

      try {
        const { status, payload } = await requestGeneration(caseItem)
        const asset = payload.assets?.[0]
        if (!asset) throw new Error('Generation response contained no asset')
        const { originals, targets, inspections } = await persistFrames(caseItem, runId, asset)
        const checks = hardChecks(caseItem, asset, inspections)
        const record: GenerationRunRecord = {
          run_id: runId,
          case_id: caseItem.case_id,
          attempt,
          mode,
          status: 'success',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
          endpoint: `${BASE_URL}/api/generate`,
          model: health.model ?? 'unknown',
          http_status: status,
          retryable: false,
          budget_frames_reserved: budgetFrames,
          estimated_cost_upper_cny: asset.frames.length * PRICE_UPPER_CNY_PER_IMAGE,
          params: caseItem,
          structured_prompt: payload.structuredPrompt,
          asset_id: asset.id,
          actual_frame_count: asset.frames.length,
          output_paths: { original: originals, target: targets },
          inspections,
          hard_checks: checks,
          hard_pass: Object.values(checks).every(Boolean),
        }
        await appendJsonLine(recordsPath, record)
        records.push(record)
        console.info(`${caseItem.case_id} saved ${asset.frames.length} frame(s); hard_pass=${record.hard_pass}`)
        break
      } catch (error) {
        const httpStatus = error instanceof HttpError ? error.status : undefined
        const networkError = error instanceof NetworkError
        const errorMessage = error instanceof Error ? error.message : String(error)
        const retryable = shouldRetry(httpStatus, attempt, networkError, errorMessage)
        const failedBudgetFrames = error instanceof HttpError ? 0 : budgetFrames
        if (error instanceof HttpError) reservedImages -= budgetFrames
        const record: GenerationRunRecord = {
          run_id: runId,
          case_id: caseItem.case_id,
          attempt,
          mode,
          status: 'failed',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - started,
          endpoint: `${BASE_URL}/api/generate`,
          model: health.model ?? 'unknown',
          http_status: httpStatus,
          error_type: error instanceof HttpError ? 'http' : networkError ? 'network' : 'processing',
          error_message: errorMessage,
          retryable,
          budget_frames_reserved: failedBudgetFrames,
          estimated_cost_upper_cny: failedBudgetFrames * PRICE_UPPER_CNY_PER_IMAGE,
          params: caseItem,
        }
        await appendJsonLine(recordsPath, record)
        records.push(record)
        console.error(`${caseItem.case_id} failed: ${record.error_message}; retryable=${retryable}`)
        if (!retryable) break
      }
    }
  }

  const successes = records.filter((record) => record.status === 'success').length
  console.info(`Run complete: ${successes} successful cases recorded, ${reservedImages}/${MAX_IMAGES} images reserved`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await runGeneration()
}
