import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildCases } from './cases'
import { inspectFrame } from './lib/image-checks'
import { appendJsonLine, readJsonLines } from './lib/records'
import { shouldRetry, wouldExceedBudget } from './run-generation'
import {
  median,
  normalizeUsableCalibration,
  percentileNearestRank,
  projectedDurationMs,
  projectedHardChecks,
  rate,
  SCENARIO_REQUEST_TIMEOUT_MS,
  SIMULATED_TIMEOUT_CASE_IDS,
} from './build-report'
import type { QualityScore } from './observed-scores'

let scratchDir = ''

beforeAll(async () => {
  scratchDir = await mkdtemp(join(tmpdir(), 'spritecraft-eval-'))
})

afterAll(async () => {
  await rm(scratchDir, { recursive: true, force: true })
})

describe('frozen evaluation matrix', () => {
  it('covers every category, style, and complexity combination exactly once', () => {
    const cases = buildCases()

    expect(cases).toHaveLength(48)
    expect(new Set(cases.map((item) => item.case_id)).size).toBe(48)
    expect(new Set(cases.map((item) => `${item.category}/${item.style}/${item.complexity}`)).size).toBe(48)
    expect(cases.filter((item) => item.size === '32x32').length).toBeGreaterThanOrEqual(2)
    expect(cases.filter((item) => item.size === '256x256').length).toBeGreaterThanOrEqual(2)
    expect(cases.filter((item) => item.category === 'effect').every((item) => item.frame_count === 6)).toBe(true)
  })
})

describe('deterministic image checks', () => {
  it('distinguishes transparent, blank, and varied frames', async () => {
    const transparentPath = join(scratchDir, 'transparent.png')
    const blankPath = join(scratchDir, 'blank.png')
    const opaqueRgbPath = join(scratchDir, 'opaque-rgb.png')
    const variedPath = join(scratchDir, 'varied.png')
    await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toFile(transparentPath)
    await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    }).png().toFile(blankPath)
    await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 240, g: 240, b: 240 } },
    }).png().toFile(opaqueRgbPath)
    const pixels = Buffer.alloc(64 * 64 * 4)
    for (let index = 0; index < 64 * 64; index += 1) {
      const value = index % 2 === 0 ? 0 : 255
      pixels.set([value, 255 - value, 64, 255], index * 4)
    }
    await sharp(pixels, { raw: { width: 64, height: 64, channels: 4 } }).png().toFile(variedPath)

    const transparent = await inspectFrame(transparentPath, '64x64', true)
    const blank = await inspectFrame(blankPath, '64x64', false)
    const opaqueRgb = await inspectFrame(opaqueRgbPath, '64x64', true)
    const varied = await inspectFrame(variedPath, '64x64', true)

    expect(transparent).toMatchObject({ dimensions_correct: true, has_alpha_channel: true, has_transparent_pixels: true, alpha_min: 0, alpha_max: 0 })
    expect(blank.blank).toBe(true)
    expect(opaqueRgb).toMatchObject({ has_alpha_channel: false, has_transparent_pixels: false, alpha_min: 255, alpha_max: 255, transparent_requirement_pass: false })
    expect(varied.blank).toBe(false)
    expect(varied.has_transparent_pixels).toBe(false)
  })
})

describe('resumable records', () => {
  it('appends and reads JSONL records without overwriting earlier attempts', async () => {
    const recordPath = join(scratchDir, 'runs.jsonl')
    await appendJsonLine(recordPath, { run_id: 'run-1', status: 'failed' })
    await appendJsonLine(recordPath, { run_id: 'run-2', status: 'success' })

    expect(await readJsonLines(recordPath)).toEqual([
      { run_id: 'run-1', status: 'failed' },
      { run_id: 'run-2', status: 'success' },
    ])
  })
})

describe('production runner guardrails', () => {
  it('retries only transient first-attempt failures', () => {
    expect(shouldRetry(undefined, 1, true)).toBe(true)
    expect(shouldRetry(429, 1)).toBe(true)
    expect(shouldRetry(503, 1)).toBe(true)
    expect(shouldRetry(502, 1, false, '403 account has an overdue balance')).toBe(false)
    expect(shouldRetry(400, 1)).toBe(false)
    expect(shouldRetry(503, 2)).toBe(false)
  })

  it('stops before exceeding the image budget', () => {
    expect(wouldExceedBudget(116, 6, 120)).toBe(false)
    expect(wouldExceedBudget(117, 4, 120)).toBe(true)
  })
})

describe('report KPI formulas', () => {
  it('calculates rates, median, and nearest-rank P95 without hiding denominators', () => {
    expect(rate(7, 32)).toBeCloseTo(0.21875)
    expect(rate(0, 0)).toBeNull()
    expect(median([1, 2, 100, 200])).toBe(51)
    expect(percentileNearestRank(Array.from({ length: 20 }, (_, index) => index + 1), 0.95)).toBe(19)
  })

  it('locks the user-specified all-usable simulation assumptions', () => {
    const rawScore: QualityScore = {
      case_id: 'GEN-001',
      semantic_restoration: 2,
      style_match: 3,
      palette_consistency: 4,
      small_size_readability: 1,
      multi_frame_consistency: 2,
      game_pipeline_usability: 1,
      text_or_watermark: false,
      obvious_crop: true,
      unparseable_or_blank: false,
      notes: 'raw calibration fixture',
    }
    const normalized = normalizeUsableCalibration(rawScore)

    expect(Object.values(projectedHardChecks()).every(Boolean)).toBe(true)
    expect(normalized).toMatchObject({
      semantic_restoration: 4,
      style_match: 4,
      palette_consistency: 4,
      small_size_readability: 4,
      multi_frame_consistency: 4,
      game_pipeline_usability: 4,
    })
  })

  it('locks the 45-success and three-timeout scenario', () => {
    const cases = buildCases()
    const timeoutCases = cases.filter((item) => SIMULATED_TIMEOUT_CASE_IDS.has(item.case_id))

    expect(timeoutCases).toHaveLength(3)
    expect(timeoutCases.every((item) => item.category === 'effect' && item.complexity === 'L2' && item.frame_count === 6)).toBe(true)
    expect(timeoutCases.every((item) => projectedDurationMs(item, true) === SCENARIO_REQUEST_TIMEOUT_MS)).toBe(true)
    expect(Object.values(projectedHardChecks(false)).some(Boolean)).toBe(false)
    expect(cases.length - timeoutCases.length).toBe(45)
  })
})
