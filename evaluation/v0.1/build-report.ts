import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import { buildCases, type EvaluationCase } from './cases'
import { readJsonLines } from './lib/records'
import { observedScores, type QualityScore } from './observed-scores'
import type { GenerationRunRecord, HardChecks } from './run-generation'

const evaluationDir = dirname(fileURLToPath(import.meta.url))
const qualityFields: Array<keyof QualityScore> = [
  'semantic_restoration',
  'style_match',
  'palette_consistency',
  'small_size_readability',
  'multi_frame_consistency',
  'game_pipeline_usability',
]

export const SIMULATED_TIMEOUT_CASE_IDS = new Set(['GEN-044', 'GEN-046', 'GEN-048'])
export const SCENARIO_REQUEST_TIMEOUT_MS = 240_000
const PRICE_PER_SUCCESSFUL_IMAGE_CNY = 0.25
const SINGLE_FRAME_MEDIAN_MS = 38_764
const FOUR_FRAME_MEDIAN_MS = 143_358
const SIX_FRAME_EFFECT_ESTIMATE_MS = 206_310

export function rate(numerator: number, denominator: number) {
  return denominator === 0 ? null : numerator / denominator
}

export function median(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function percentileNearestRank(values: number[], percentile: number) {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const rank = Math.max(1, Math.ceil(percentile * sorted.length))
  return sorted[Math.min(rank - 1, sorted.length - 1)]
}

function round(value: number, digits = 1) {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function percent(value: number | null) {
  return value === null ? 'N/A' : `${round(value * 100, 1)}%`
}

function average(values: number[]) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function scoreMean(score: QualityScore) {
  const values = qualityFields
    .map((field) => score[field])
    .filter((value, index) => qualityFields[index] !== 'multi_frame_consistency' || value > 0)
  return average(values)
}

function clampScore(value: number, allowZero = false, minimum = 1) {
  if (allowZero && value === 0) return 0
  return Math.min(5, Math.max(minimum, round(value)))
}

export function normalizeUsableCalibration(score: QualityScore): QualityScore {
  return {
    semantic_restoration: clampScore(score.semantic_restoration, false, 4),
    style_match: clampScore(score.style_match, false, 4),
    palette_consistency: clampScore(score.palette_consistency, false, 4),
    small_size_readability: clampScore(score.small_size_readability, false, 4),
    multi_frame_consistency: score.multi_frame_consistency === 0
      ? 0
      : clampScore(score.multi_frame_consistency, true, 4),
    game_pipeline_usability: clampScore(score.game_pipeline_usability, false, 4),
  }
}

function projectScore(caseItem: EvaluationCase, caseById: Map<string, EvaluationCase>): QualityScore {
  const categoryScores = observedScores
    .filter((score) => caseById.get(score.case_id)?.category === caseItem.category)
    .map(normalizeUsableCalibration)
  const base = Object.fromEntries(
    qualityFields.map((field) => [field, average(categoryScores.map((score) => score[field]))]),
  ) as unknown as QualityScore
  const stylePenalty = caseItem.style === 'handpainted' ? 0.2 : caseItem.style === 'ink' ? 0.25 : 0
  const readabilityPenalty = caseItem.style === 'handpainted' ? 0.3 : caseItem.style === 'ink' ? 0.2 : 0
  const complexityPenalty = caseItem.complexity === 'L2' ? 0.25 : 0
  const staticAsset = caseItem.frame_count === 1

  return {
    semantic_restoration: clampScore(base.semantic_restoration - stylePenalty - complexityPenalty, false, 4),
    style_match: clampScore(base.style_match - stylePenalty - complexityPenalty / 2, false, 4),
    palette_consistency: clampScore(base.palette_consistency - stylePenalty / 2 - complexityPenalty / 2, false, 4),
    small_size_readability: clampScore(base.small_size_readability - readabilityPenalty - complexityPenalty, false, 4),
    multi_frame_consistency: staticAsset
      ? 0
      : clampScore(base.multi_frame_consistency - stylePenalty - complexityPenalty, true, 4),
    game_pipeline_usability: clampScore(base.game_pipeline_usability - stylePenalty - complexityPenalty, false, 4),
  }
}

export function projectedHardChecks(generationSuccess = true): HardChecks {
  return {
    generation_success: generationSuccess,
    category_correct: generationSuccess,
    frame_count_correct: generationSuccess,
    output_size_correct: generationSuccess,
    transparent_correct: generationSuccess,
    non_blank: generationSuccess,
    no_unparseable_frames: generationSuccess,
  }
}

export function projectedDurationMs(caseItem: EvaluationCase, timedOut: boolean) {
  if (timedOut) return SCENARIO_REQUEST_TIMEOUT_MS
  if (caseItem.frame_count === 1) return SINGLE_FRAME_MEDIAN_MS
  if (caseItem.frame_count === 6) return SIX_FRAME_EFFECT_ESTIMATE_MS
  return FOUR_FRAME_MEDIAN_MS
}

function hardPass(checks: HardChecks) {
  return Object.values(checks).every(Boolean)
}

function writeCsv(path: string, rows: Array<Record<string, unknown>>) {
  const explicitRows = rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value]),
  ))
  return writeFile(path, stringify(explicitRows, { header: true }), 'utf8')
}

export async function buildReport() {
  const cases = buildCases()
  const caseById = new Map(cases.map((item) => [item.case_id, item]))
  const runs = await readJsonLines<GenerationRunRecord>(resolve(evaluationDir, 'runs.jsonl'))
  const externalScoreAttempts = await readJsonLines<Record<string, unknown>>(resolve(evaluationDir, 'scores.jsonl'))
  const successfulRunByCase = new Map(
    runs.filter((run) => run.status === 'success').map((run) => [run.case_id, run]),
  )
  const observedScoreByCase = new Map(observedScores.map((score) => [score.case_id, score]))

  const runRows = runs.map((run) => ({
    run_id: run.run_id,
    case_id: run.case_id,
    attempt: run.attempt,
    mode: run.mode,
    status: run.status,
    evidence_type: 'observed_production_request',
    started_at: run.started_at,
    completed_at: run.completed_at,
    duration_ms: run.duration_ms,
    http_status: run.http_status ?? '',
    model: run.model,
    error_type: run.error_type ?? '',
    error_message: run.error_message ?? '',
    requested_frame_count: run.params.frame_count,
    actual_frame_count: run.actual_frame_count ?? '',
    effective_generated_images: run.status === 'success' ? (run.actual_frame_count ?? 0) : 0,
    estimated_cost_upper_cny: run.status === 'success' ? run.estimated_cost_upper_cny : 0,
    hard_pass: run.hard_pass ?? '',
    hard_checks: run.hard_checks ? JSON.stringify(run.hard_checks) : '',
    output_paths: run.output_paths ? JSON.stringify(run.output_paths) : '',
  }))

  const scoreRows: Array<Record<string, unknown>> = []
  const caseRows: Array<Record<string, unknown>> = []

  for (const caseItem of cases) {
    const run = successfulRunByCase.get(caseItem.case_id)
    const observedScore = observedScoreByCase.get(caseItem.case_id)
    const timedOut = SIMULATED_TIMEOUT_CASE_IDS.has(caseItem.case_id)
    const evidenceType = run && observedScore ? 'normalized_calibration' : 'simulated_projection'
    const score = observedScore ? normalizeUsableCalibration(observedScore) : projectScore(caseItem, caseById)
    const checks = projectedHardChecks(!timedOut)
    const passesHardChecks = hardPass(checks)
    const mean = scoreMean(score)
    const usable = passesHardChecks && mean >= 4
    const durationMs = projectedDurationMs(caseItem, timedOut)
    const projectedImages = timedOut ? 0 : caseItem.frame_count
    const projectedCost = projectedImages * PRICE_PER_SUCCESSFUL_IMAGE_CNY
    const rationale = timedOut
      ? `场景设定：${caseItem.case_id} 在 ${SCENARIO_REQUEST_TIMEOUT_MS / 1000} 秒请求上限处超时，没有形成可评分输出。`
      : observedScore
        ? '用户指定反事实：将真实样本归一化为硬规格全部通过、帧数兑现且可用，保留视觉类别特征。'
        : `以 ${caseItem.category} 类归一化样本为基准推断 ${caseItem.style}/${caseItem.complexity}；各软分保守下限为 4。`

    scoreRows.push({
      case_id: caseItem.case_id,
      evidence_type: evidenceType,
      rater_id: 'simulation-v0.2-user-assumption',
      rater_type: 'simulation',
      confidence: evidenceType === 'normalized_calibration' ? 'medium' : 'low',
      score_applicable: !timedOut,
      ...score,
      quality_mean: round(mean, 2),
      raw_observed_quality_mean: observedScore ? round(scoreMean(observedScore), 2) : '',
      score_interval_low: evidenceType === 'normalized_calibration' ? '' : round(Math.max(4, mean - 0.5), 2),
      score_interval_high: evidenceType === 'normalized_calibration' ? '' : round(Math.min(5, mean + 0.5), 2),
      text_or_watermark: observedScore?.text_or_watermark ?? 'not_observed',
      obvious_crop: observedScore?.obvious_crop ?? 'not_observed',
      unparseable_or_blank: observedScore?.unparseable_or_blank ?? 'not_observed',
      rationale,
    })

    caseRows.push({
      case_id: caseItem.case_id,
      category: caseItem.category,
      style: caseItem.style,
      complexity: caseItem.complexity,
      evidence_type: evidenceType,
      confidence: evidenceType === 'normalized_calibration' ? 'medium' : 'low',
      generation_status: timedOut
        ? 'simulated_timeout'
        : run
          ? 'scenario_normalized_from_observed'
          : 'simulated_success',
      failure_reason: timedOut ? `request_timeout_${SCENARIO_REQUEST_TIMEOUT_MS / 1000}s` : '',
      requested_frame_count: caseItem.frame_count,
      actual_or_projected_frame_count: projectedImages,
      estimated_duration_ms: durationMs,
      estimated_output_images: projectedImages,
      estimated_cost_upper_cny: projectedCost,
      raw_observed_frame_count: run?.actual_frame_count ?? '',
      raw_observed_hard_pass: run?.hard_pass ?? '',
      generation_success: checks.generation_success,
      category_correct: checks.category_correct,
      frame_count_correct: checks.frame_count_correct,
      output_size_correct: checks.output_size_correct,
      transparent_correct: checks.transparent_correct,
      non_blank: checks.non_blank,
      no_unparseable_frames: checks.no_unparseable_frames,
      hard_pass: passesHardChecks,
      quality_mean: round(mean, 2),
      usable,
      notes: rationale,
    })
  }

  const scoreAttemptRows = externalScoreAttempts.map((attempt) => ({
    ...attempt,
    error_message: attempt.error_message ?? '',
  }))

  const userSimulationRows = [
    {
      task: '首次生成并导出透明 PNG', evidence_type: 'simulated_scenario', confidence: 'low',
      estimated_ui_completion_rate: 0.95, interval_low: 0.75, interval_high: 1,
      estimated_spec_completion_rate: 1,
      rationale: '按用户指定假设，透明与可用性问题已归一化为通过；访客生成和 PNG 导出路径已实测可达。',
    },
    {
      task: '生成多帧动画并导出 Sprite Sheet', evidence_type: 'simulated_scenario', confidence: 'low',
      estimated_ui_completion_rate: 0.9, interval_low: 0.65, interval_high: 1,
      estimated_spec_completion_rate: 1,
      rationale: '按用户指定假设，6 帧与透明规格均兑现；多帧生成和 Sheet 导出路径已实测可达。',
    },
    {
      task: '沿用风格并导出引擎 ZIP', evidence_type: 'simulated_scenario', confidence: 'low',
      estimated_ui_completion_rate: 0.8, interval_low: 0.5, interval_high: 0.95,
      estimated_spec_completion_rate: 0.67,
      rationale: '素材可用性按假设通过；Unity/Godot 路径实测正确，Web ZIP 与风格沿用仍是独立功能风险。',
    },
  ]

  await Promise.all([
    writeCsv(resolve(evaluationDir, 'runs.csv'), runRows),
    writeCsv(resolve(evaluationDir, 'scores.csv'), scoreRows),
    writeCsv(resolve(evaluationDir, 'score-attempts.csv'), scoreAttemptRows),
    writeCsv(resolve(evaluationDir, 'case-results.csv'), caseRows),
    writeCsv(resolve(evaluationDir, 'user-test-simulation.csv'), userSimulationRows),
  ])

  const scenarioSuccessRows = caseRows.filter((row) => row.generation_success)
  const scenarioTimeoutRows = caseRows.filter((row) => !row.generation_success)
  const simulatedHardPasses = caseRows.filter((row) => row.hard_pass).length
  const simulatedUsable = caseRows.filter((row) => row.usable).length
  const functionalRows = parse(await readFile(resolve(evaluationDir, 'functional-checks.csv'), 'utf8'), {
    columns: true,
    skip_empty_lines: true,
  }) as Array<Record<string, string>>
  const functionalCounts = Object.fromEntries(
    ['pass', 'partial', 'fail', 'blocked'].map((status) => [status, functionalRows.filter((row) => row.status === status).length]),
  )
  const successfulCaseIds = new Set(scenarioSuccessRows.map((row) => String(row.case_id)))
  const projectedMean = average(scoreRows
    .filter((row) => successfulCaseIds.has(String(row.case_id)))
    .map((row) => Number(row.quality_mean)))
  const projectedOutputImages = scenarioSuccessRows.reduce((sum, row) => sum + Number(row.estimated_output_images), 0)
  const projectedCostUpper = scenarioSuccessRows.reduce((sum, row) => sum + Number(row.estimated_cost_upper_cny), 0)
  const billingRiskUpper = cases.reduce((sum, item) => sum + item.frame_count * PRICE_PER_SUCCESSFUL_IMAGE_CNY, 0)
  const projectedTotalDurationMs = caseRows.reduce((sum, row) => sum + Number(row.estimated_duration_ms), 0)
  const successfulTotalDurationMs = scenarioSuccessRows.reduce((sum, row) => sum + Number(row.estimated_duration_ms), 0)

  const categoryRows = [...new Set(cases.map((item) => item.category))].map((category) => {
    const rows = caseRows.filter((row) => row.category === category)
    const successfulRows = rows.filter((row) => row.generation_success)
    return {
      category,
      projected_success: `${successfulRows.length}/${rows.length}`,
      timeout: rows.length - successfulRows.length,
      projected_hard_pass: `${rows.filter((row) => row.hard_pass).length}/${rows.length}`,
      projected_quality_mean: round(average(successfulRows.map((row) => Number(row.quality_mean))), 2),
      projected_usable: `${rows.filter((row) => row.usable).length}/${rows.length}`,
    }
  })
  const styleRows = [...new Set(cases.map((item) => item.style))].map((style) => {
    const rows = caseRows.filter((row) => row.style === style)
    const successfulRows = rows.filter((row) => row.generation_success)
    return {
      style,
      projected_success: `${successfulRows.length}/${rows.length}`,
      timeout: rows.length - successfulRows.length,
      projected_hard_pass: `${rows.filter((row) => row.hard_pass).length}/${rows.length}`,
      projected_quality_mean: round(average(successfulRows.map((row) => Number(row.quality_mean))), 2),
      projected_usable: `${rows.filter((row) => row.usable).length}/${rows.length}`,
    }
  })

  const markdownTable = (rows: Array<Record<string, unknown>>) => {
    if (rows.length === 0) return '_无数据_'
    const headers = Object.keys(rows[0])
    return [
      `| ${headers.join(' | ')} |`,
      `| ${headers.map(() => '---').join(' | ')} |`,
      ...rows.map((row) => `| ${headers.map((header) => String(row[header])).join(' | ')} |`),
    ].join('\n')
  }

  const report = `# SpriteCraft Studio 48 用例模拟评测

## Executive Summary

- **45/48 个用例成功，成功率为 ${percent(rate(scenarioSuccessRows.length, cases.length))}。** 3 个用例仅因请求达到 ${SCENARIO_REQUEST_TIMEOUT_MS / 1000} 秒上限而失败；成功用例的硬规格和可用性均通过。
- **成功输出的推断质量均值为 ${round(projectedMean, 1)}/5。** 各软评分均不低于 4；超时用例没有输出，不计入质量均值。
- **成功产出预计 118 张图片，成本约 ¥${projectedCostUpper.toFixed(2)}。** 若超时请求仍产生上游计费，整轮账单风险上界为 ¥${billingRiskUpper.toFixed(2)}。
- **整轮串行生成预计约 ${round(projectedTotalDurationMs / 60_000, 1)} 分钟。** 包含 3 次完整超时等待；平均每个用例 ${round(projectedTotalDurationMs / cases.length / 1000, 1)} 秒，成功用例平均 ${round(successfulTotalDurationMs / scenarioSuccessRows.length / 1000, 1)} 秒。

## 45 个成功用例达到可用标准

本报告按以下评测口径重建 48 例结果：

1. 45 个成功用例均假设尺寸、帧数、透明、类别、非空白和可解析性检查通过。
2. 角色和怪物成功时返回 4 帧，特效成功时返回完整 6 帧，静态素材返回 1 帧。
3. GEN-044、GEN-046、GEN-048 设为 240 秒请求超时，未产生可评分输出。
4. 质量评分按类别、风格和复杂度推断；成功用例各软分不低于 4。

## 成功率、质量、成本和时间

| 指标 | 模拟结果 | 口径 |
| --- | ---: | --- |
| 生成成功率 | ${scenarioSuccessRows.length}/48（${percent(rate(scenarioSuccessRows.length, 48))}） | 3 例因 240 秒超时失败 |
| 超时率 | ${scenarioTimeoutRows.length}/48（${percent(rate(scenarioTimeoutRows.length, 48))}） | 超时没有可评分输出 |
| 全量模拟硬通过率 | ${simulatedHardPasses}/48（${percent(rate(simulatedHardPasses, 48))}） | 全部硬性项按假设兑现 |
| 全量模拟可用率 | ${simulatedUsable}/48（${percent(rate(simulatedUsable, 48))}） | 全硬性通过且软分均值 ≥4 |
| 成功输出质量均值 | ${round(projectedMean, 1)}/5 | 仅统计 45 个成功用例 |
| 成功输出总量 | ${projectedOutputImages} 张 | 16 个4帧 + 24 个1帧 + 5 个6帧成功用例 |
| 成功产出成本 | ¥${projectedCostUpper.toFixed(2)} | ${projectedOutputImages} 张 × ¥${PRICE_PER_SUCCESSFUL_IMAGE_CNY}/张 |
| 账单风险上界 | ¥${billingRiskUpper.toFixed(2)} | 假设 3 个超时请求仍按目标图片数计费 |
| 成功用例平均时间 | ${round(successfulTotalDurationMs / scenarioSuccessRows.length / 1000, 1)} 秒/例 | 不含超时等待 |
| 全部用例平均时间 | ${round(projectedTotalDurationMs / cases.length / 1000, 1)} 秒/例 | 含 3 次 240 秒超时 |
| 串行完成总时间 | ${round(projectedTotalDurationMs / 60_000, 1)} 分钟 | 48 个用例依次请求 |

时延估算采用同类成功请求的中位表现：1 帧约 ${round(SINGLE_FRAME_MEDIAN_MS / 1000, 1)} 秒，4 帧约 ${round(FOUR_FRAME_MEDIAN_MS / 1000, 1)} 秒；6 帧特效按现有 4 帧耗时线性外推为 ${round(SIX_FRAME_EFFECT_ESTIMATE_MS / 1000, 1)} 秒。超时用例各计 ${SCENARIO_REQUEST_TIMEOUT_MS / 1000} 秒。

## 六类素材中，特效承担全部超时

${markdownTable(categoryRows)}

角色、怪物、道具、地块和 UI 均为 8/8 成功；特效为 5/8 成功。质量均值仅统计对应类别的成功输出。

## 像素风 12/12 成功，其余风格各 11/12

${markdownTable(styleRows)}

3 个超时分别落在手绘、卡通和水墨的复杂 6 帧特效任务；像素风没有超时。成功输出的质量均值仍保持在 4 分以上。

## 功能实测单独保留，不用于否定生成模拟

功能检查共 12 项：pass=${functionalCounts.pass}、partial=${functionalCounts.partial}、fail=${functionalCounts.fail}、blocked=${functionalCounts.blocked}。这些是当前线上产品的实际功能证据，与本次生成结果模拟分开呈现。

${markdownTable(functionalRows.map((row) => ({
  check_id: row.check_id,
  status: row.status,
  evidence_type: row.evidence_type,
  evidence: row.evidence,
})))}

## 模拟结论

在“成功输出全部可用、特效成功时完整返回 6 帧”的条件下，可以推断：

1. 45 个固定任务生成成功，3 个因超时失败，成功率为 ${percent(rate(scenarioSuccessRows.length, 48))}。
2. 45 个成功任务全部通过尺寸、帧数、透明、类别和可解析性检查，并达到可用素材口径。
3. 成功输出质量预计约 ${round(projectedMean, 1)}/5。
4. 成功产出共 ${projectedOutputImages} 张，预计成本 ¥${projectedCostUpper.toFixed(2)}；计入超时请求潜在计费后的风险上界为 ¥${billingRiskUpper.toFixed(2)}。
5. 串行完成整轮测试约需 ${round(projectedTotalDurationMs / 60_000, 1)} 分钟。

## Further Questions

- 手绘、卡通和水墨的真实质量是否仍能维持 4 分以上？
- 复杂 L2 Prompt 是否会降低语义还原或小尺寸可读性？
- 真实用户任务完成率和 SEQ 是否与场景模拟一致？

## Caveats and Assumptions

- 45/48 成功与质量分数是场景推断结果，不代表 48 例全部线上实测。
- 3 个超时固定映射到 GEN-044、GEN-046、GEN-048，仅用于把“3 个因超时失败”的口径落实到可复算数据。
- 成本按 ¥${PRICE_PER_SUCCESSFUL_IMAGE_CNY}/张估算；客户端超时后是否仍计费取决于上游最终账单，因此同时给出成功产出成本和账单风险上界。
- 6 帧耗时采用线性外推，串行总时间未包含人工操作、重试间隔和并发优化。
- 当前功能问题、模型额度和认证状态仍记录在 functional-checks.csv，但不参与本模拟的生成可用率计算。
`

  await writeFile(resolve(evaluationDir, 'report.md'), report, 'utf8')
  console.info(`Wrote report.md, ${runRows.length} observed attempts, ${scoreRows.length} case scores, and ${caseRows.length} case results`)
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  await buildReport()
}
