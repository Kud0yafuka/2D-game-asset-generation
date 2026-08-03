import { mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import OpenAI from 'openai'
import sharp from 'sharp'
import { appendJsonLine, readJsonLines } from './lib/records'
import type { GenerationRunRecord } from './run-generation'

const evaluationDir = dirname(fileURLToPath(import.meta.url))
const runsPath = resolve(evaluationDir, 'runs.jsonl')
const scoresPath = resolve(evaluationDir, 'scores.jsonl')
const contactsDir = resolve(evaluationDir, 'contact-sheets')
const judgeModel = process.env.EVAL_JUDGE_MODEL ?? 'gpt-5.2'

interface QualityScores {
  semantic_restoration: number
  style_match: number
  palette_consistency: number
  small_size_readability: number
  multi_frame_consistency: number
  game_pipeline_usability: number
  text_or_watermark: boolean
  obvious_crop: boolean
  unparseable_or_blank: boolean
  rationale: string
}

export interface ScoreRecord extends QualityScores {
  case_id: string
  run_id: string
  status: 'success' | 'blocked'
  evidence_type: 'observed_image_auto_rater'
  rater_id: string
  rater_type: 'auto_model'
  model: string
  response_id?: string
  contact_sheet_path: string
  scored_at: string
  error_message?: string
}

function checkerboard(width: number, height: number, tileSize = 16) {
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const shade = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0 ? 238 : 208
      const offset = (y * width + x) * 4
      pixels.set([shade, shade, shade, 255], offset)
    }
  }
  return pixels
}

export async function buildContactSheet(framePaths: string[], outputPath: string) {
  const cellSize = 256
  const gap = 12
  const width = framePaths.length * cellSize + Math.max(framePaths.length - 1, 0) * gap
  const height = cellSize
  const layers = await Promise.all(
    framePaths.map(async (path, index) => ({
      input: await sharp(resolve(evaluationDir, path))
        .resize(cellSize, cellSize, { fit: 'contain', kernel: sharp.kernel.nearest })
        .png()
        .toBuffer(),
      left: index * (cellSize + gap),
      top: 0,
    })),
  )
  await mkdir(dirname(outputPath), { recursive: true })
  await sharp(checkerboard(width, height), { raw: { width, height, channels: 4 } })
    .composite(layers)
    .png()
    .toFile(outputPath)
}

function scoringPrompt(run: GenerationRunRecord) {
  const item = run.params
  return [
    'Evaluate this AI-generated 2D game asset contact sheet. Score only what is visible.',
    `Expected prompt: ${item.prompt_raw}`,
    `Expected category=${item.category}, style=${item.style}, palette=${item.palette}, target=${item.size}, requested_frames=${item.frame_count}, visible_frames=${run.actual_frame_count}.`,
    'Scores are integers 1-5: 1=unusable/strong mismatch, 3=recognizable with material defects, 5=production-ready/strong match.',
    'Score semantic restoration, style match, palette consistency, readability at the stated small target size, and game-pipeline usability.',
    'For multi-frame consistency, use 0 only when the asset is static (one visible frame); otherwise score identity, scale, camera, lighting, palette, and motion continuity.',
    'Flag visible text/watermark, obvious crop, and unparseable/blank output. Keep the rationale under 80 Chinese characters.',
  ].join('\n')
}

const scoreSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'semantic_restoration',
    'style_match',
    'palette_consistency',
    'small_size_readability',
    'multi_frame_consistency',
    'game_pipeline_usability',
    'text_or_watermark',
    'obvious_crop',
    'unparseable_or_blank',
    'rationale',
  ],
  properties: {
    semantic_restoration: { type: 'integer', minimum: 1, maximum: 5 },
    style_match: { type: 'integer', minimum: 1, maximum: 5 },
    palette_consistency: { type: 'integer', minimum: 1, maximum: 5 },
    small_size_readability: { type: 'integer', minimum: 1, maximum: 5 },
    multi_frame_consistency: { type: 'integer', minimum: 0, maximum: 5 },
    game_pipeline_usability: { type: 'integer', minimum: 1, maximum: 5 },
    text_or_watermark: { type: 'boolean' },
    obvious_crop: { type: 'boolean' },
    unparseable_or_blank: { type: 'boolean' },
    rationale: { type: 'string' },
  },
} as const

function transientJudgeError(error: unknown, attempt: number) {
  const status = (error as { status?: number }).status
  return attempt === 1 && (status === undefined || status === 429 || status >= 500)
}

export async function scoreResults() {
  const runs = await readJsonLines<GenerationRunRecord>(runsPath)
  const successfulRuns = runs.filter((run) => run.status === 'success' && run.output_paths?.target.length)
  const existing = await readJsonLines<ScoreRecord>(scoresPath)
  const completed = new Set(existing.map((score) => score.case_id))
  const apiKey = process.env.OPENAI_API_KEY
  const client = apiKey ? new OpenAI({ apiKey, timeout: 120_000 }) : undefined

  for (const run of successfulRuns) {
    if (completed.has(run.case_id)) continue
    const contactPath = resolve(contactsDir, `${run.case_id}.png`)
    await buildContactSheet(run.output_paths!.target, contactPath)
    const relativeContactPath = contactPath.slice(evaluationDir.length + 1)

    if (!client) {
      await appendJsonLine(scoresPath, {
        case_id: run.case_id,
        run_id: run.run_id,
        status: 'blocked',
        evidence_type: 'observed_image_auto_rater',
        rater_id: `auto-openai-${judgeModel}`,
        rater_type: 'auto_model',
        model: judgeModel,
        contact_sheet_path: relativeContactPath,
        scored_at: new Date().toISOString(),
        error_message: 'OPENAI_API_KEY is not configured',
      } satisfies Partial<ScoreRecord>)
      continue
    }

    let finalError = ''
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const image = await readFile(contactPath)
        const response = await client.responses.create({
          model: judgeModel,
          instructions: 'You are a strict visual evaluator for production 2D game assets. Return calibrated scores, not encouragement.',
          input: [
            {
              role: 'user',
              content: [
                { type: 'input_text', text: scoringPrompt(run) },
                { type: 'input_image', image_url: `data:image/png;base64,${image.toString('base64')}`, detail: 'high' },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'spritecraft_quality_score',
              strict: true,
              schema: scoreSchema,
            },
          },
        })
        const scores = JSON.parse(response.output_text) as QualityScores
        const record: ScoreRecord = {
          ...scores,
          case_id: run.case_id,
          run_id: run.run_id,
          status: 'success',
          evidence_type: 'observed_image_auto_rater',
          rater_id: `auto-openai-${judgeModel}`,
          rater_type: 'auto_model',
          model: judgeModel,
          response_id: response.id,
          contact_sheet_path: relativeContactPath,
          scored_at: new Date().toISOString(),
        }
        await appendJsonLine(scoresPath, record)
        finalError = ''
        console.info(`${run.case_id} scored by ${judgeModel}`)
        break
      } catch (error) {
        finalError = error instanceof Error ? error.message : String(error)
        console.warn(`${run.case_id} scoring attempt ${attempt} failed: ${finalError}`)
        if (transientJudgeError(error, attempt)) continue
        break
      }
    }

    if (finalError) {
      await appendJsonLine(scoresPath, {
        case_id: run.case_id,
        run_id: run.run_id,
        status: 'blocked',
        evidence_type: 'observed_image_auto_rater',
        rater_id: `auto-openai-${judgeModel}`,
        rater_type: 'auto_model',
        model: judgeModel,
        contact_sheet_path: relativeContactPath,
        scored_at: new Date().toISOString(),
        error_message: finalError,
      } satisfies Partial<ScoreRecord>)
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await scoreResults()
}
