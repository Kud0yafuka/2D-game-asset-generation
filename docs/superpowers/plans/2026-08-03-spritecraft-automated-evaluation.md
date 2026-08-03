# SpriteCraft Studio Automated Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and execute a resumable online evaluator for the frozen 48-case SpriteCraft Studio matrix, deterministic hard checks, clearly labeled model-assisted soft scores, functional checks, and a source-backed baseline report.

**Architecture:** A TypeScript case builder freezes the 6×4×2 matrix into CSV. A sequential runner calls the production `/api/generate` endpoint, persists every attempt before continuing, saves original and target-size frames, and applies deterministic image checks with Sharp. A separate resumable vision judge writes model-only soft scores; a report builder converts JSONL records to the required CSV files and calculates KPIs without inventing human-test results.

**Tech Stack:** Node.js 24, TypeScript 6, tsx, Vitest, Sharp, csv-parse/stringify, OpenAI Responses API, Playwright CLI, Doubao Seedream 5.0.

## Global Constraints

- Production endpoint: `https://spritecraft-studio.onrender.com/api/generate`.
- Freeze exactly 48 cases: 6 asset categories × 4 styles × 2 complexity levels.
- Preserve the first result and every failed/retried request; never select only the best image.
- Run cases in fixed case-id order with concurrency 1.
- Retry only network, HTTP 429, and HTTP 5xx failures, at most once; both attempts remain recorded.
- Cap generated images at 120 for the 48-case baseline and stop before exceeding the cap.
- Treat automatic vision scores as `auto_rater`; never call them independent human raters.
- Do not calculate user-task completion, SEQ, or first-usable-asset time without real participants.
- Do not commit original 2K output images; retain local evidence paths and generated CSV/report artifacts.
- Public price reference used for the safety estimate: Fire Ark lists current Seedream image generation at up to ¥0.25/image; 120 images imply a conservative upper estimate of ¥30.

---

## File Structure

- `evaluation/v0.1/cases.ts`: fixed scenario, style, palette, frame, size, and seed definitions.
- `evaluation/v0.1/generate-test-cases.ts`: produce the canonical `test-cases.csv`.
- `evaluation/v0.1/test-cases.csv`: frozen 48-case input dataset.
- `evaluation/v0.1/lib/image-checks.ts`: deterministic dimension, alpha, blank, and frame checks.
- `evaluation/v0.1/lib/records.ts`: JSONL append/read and CSV projection helpers.
- `evaluation/v0.1/run-generation.ts`: resumable production runner with budget and retry controls.
- `evaluation/v0.1/score-results.ts`: resumable model-assisted quality judge.
- `evaluation/v0.1/build-report.ts`: KPI aggregation and Markdown/CSV output.
- `evaluation/v0.1/evaluation.test.ts`: matrix, image-check, and metric regression tests.
- `evaluation/v0.1/functional-checks.csv`: observed production functional outcomes.
- `evaluation/v0.1/user-test-template.md`: real-participant data collection template only.
- `evaluation/v0.1/runs.csv`, `scores.csv`, `report.md`: generated result artifacts.
- `.gitignore`: exclude `evaluation/v0.1/outputs/` and incremental `*.jsonl` execution state.
- `package.json`, `package-lock.json`: add evaluator dependencies and scripts.

### Task 1: Add evaluator dependencies and a failing matrix test

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `evaluation/v0.1/cases.ts`
- Create: `evaluation/v0.1/generate-test-cases.ts`
- Create: `evaluation/v0.1/evaluation.test.ts`

**Interfaces:**
- Produces: `buildCases(): EvaluationCase[]`, where `EvaluationCase` includes `case_id`, `category`, `style`, `complexity`, `prompt_raw`, `size`, `frame_count`, `palette`, `seed`, `transparent`, and `style_lock`.

- [ ] **Step 1: Install deterministic evaluator dependencies**

```bash
npm install --save-dev sharp csv-parse csv-stringify
```

Add scripts:

```json
"eval:cases": "tsx evaluation/v0.1/generate-test-cases.ts",
"eval:smoke": "tsx evaluation/v0.1/run-generation.ts --mode smoke",
"eval:baseline": "tsx evaluation/v0.1/run-generation.ts --mode baseline",
"eval:score": "tsx evaluation/v0.1/score-results.ts",
"eval:report": "tsx evaluation/v0.1/build-report.ts"
```

- [ ] **Step 2: Write a failing matrix contract**

The first tests must require:

```ts
expect(cases).toHaveLength(48)
expect(new Set(cases.map((item) => item.case_id)).size).toBe(48)
expect(new Set(cases.map((item) => `${item.category}/${item.style}/${item.complexity}`)).size).toBe(48)
expect(cases.filter((item) => item.size === '32x32').length).toBeGreaterThanOrEqual(2)
expect(cases.filter((item) => item.size === '256x256').length).toBeGreaterThanOrEqual(2)
expect(cases.filter((item) => item.category === 'effect').every((item) => item.frame_count === 6)).toBe(true)
```

Run `npm test -- evaluation/v0.1/evaluation.test.ts` and verify it fails because `buildCases` does not exist.

- [ ] **Step 3: Implement the frozen case builder**

Use category order `character, monster, prop, tile, ui, effect`, style order `pixel, handpainted, cartoon, ink`, and complexity order `L1, L2`. Use these fixed prompts:

```ts
const prompts = {
  character: {
    L1: '蓝色火焰骑士，正面站立，idle 待机，适合 RPG 主角',
    L2: '少女炼金师，侧身待机，手持金色药瓶，三分之二视角，森林绿与金色配色，禁止文字和裁切',
  },
  monster: {
    L1: '圆形苔藓史莱姆敌人，正面待机，轮廓清晰',
    L2: '熔岩甲壳蝎子怪物，三分之二视角，挥动尾刺攻击，橙红与深灰配色，禁止文字和多余肢体',
  },
  prop: {
    L1: '可互动的古老宝箱，单一物体，清晰轮廓',
    L2: '冰霜魔法钥匙，45 度俯视角，蓝白主色，发光宝石，禁止文字和人物',
  },
  tile: {
    L1: '俯视草地石板地块，四边可无缝拼接',
    L2: '俯视竹林小径，四边可拼接，墨绿与灰色，禁止文字、人物和透视地平线',
  },
  ui: {
    L1: '治疗药水技能图标，小尺寸语义清晰',
    L2: '冰冻技能图标，正方形构图，蓝白主色，中心雪花符号，禁止汉字、数字和细碎装饰',
  },
  effect: {
    L1: '环形水浪冲击特效，循环动画，动势清晰',
    L2: '火焰剑斩特效，左下到右上动势，橙黄主色，循环起止连续，禁止文字和人物',
  },
} as const
```

Characters and monsters use 4 frames, effects 6, and other categories 1. Tiles use `transparent=false`; all other categories use `true`. Rotate palettes in order `forest, dungeon, arcade, ember`. Use `32x32` for pixel/cartoon L2 UI, `256x256` for ink L2 character and handpainted L2 effect, and category recommendations otherwise.

- [ ] **Step 4: Generate and verify the canonical CSV**

```bash
npm run eval:cases
npm test -- evaluation/v0.1/evaluation.test.ts
```

Expected: exactly 49 CSV lines including the header and all matrix tests pass.

- [ ] **Step 5: Commit the frozen dataset and tests**

```bash
git add -- package.json package-lock.json evaluation/v0.1/cases.ts evaluation/v0.1/generate-test-cases.ts evaluation/v0.1/test-cases.csv evaluation/v0.1/evaluation.test.ts
git diff --cached --check
git commit -m "test: freeze SpriteCraft evaluation matrix"
```

### Task 2: Implement deterministic image checks and resumable records

**Files:**
- Create: `evaluation/v0.1/lib/image-checks.ts`
- Create: `evaluation/v0.1/lib/records.ts`
- Modify: `evaluation/v0.1/evaluation.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `inspectFrame(path, expectedSize, transparentRequired): Promise<FrameInspection>`.
- Produces: `appendJsonLine(path, record)` and `readJsonLines<T>(path)`.

- [ ] **Step 1: Write failing synthetic-image tests**

Create transparent and fully opaque 64×64 PNG buffers with Sharp. Require `inspectFrame` to report exact dimensions, `has_alpha_channel`, `has_transparent_pixels`, `alpha_min`, `alpha_max`, and `blank`. Require an all-white image to be `blank=true` and a two-color image to be `blank=false`.

- [ ] **Step 2: Verify the new tests fail**

```bash
npm test -- evaluation/v0.1/evaluation.test.ts
```

Expected: failure because `inspectFrame` and JSONL helpers are absent.

- [ ] **Step 3: Implement checks and records**

Use `sharp(path).metadata()` and `sharp(path).ensureAlpha().stats()`. A transparent-required check passes only when at least one pixel has alpha below 255. Mark an image blank when every RGB channel has standard deviation below 2. JSONL append must create the parent directory and write exactly one JSON object plus newline per completed attempt.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- evaluation/v0.1/evaluation.test.ts
git add -- .gitignore evaluation/v0.1/lib/image-checks.ts evaluation/v0.1/lib/records.ts evaluation/v0.1/evaluation.test.ts
git commit -m "feat: add deterministic evaluation checks"
```

### Task 3: Implement and run the production generator

**Files:**
- Create: `evaluation/v0.1/run-generation.ts`
- Runtime: `evaluation/v0.1/runs.jsonl`
- Runtime: `evaluation/v0.1/outputs/`

**Interfaces:**
- Consumes: `test-cases.csv` and production `GenerateAssetsResponse`.
- Produces: one attempt record per HTTP request plus original and target-size frame files.

- [ ] **Step 1: Write a failing retry/budget test**

Extract and test `shouldRetry(status, attempt)` and `wouldExceedBudget(currentImages, requestedFrames, maxImages)`. Retry only attempt 1 for network, 429, and 5xx. Budget must stop before exceeding 120 expected returned frames, using `min(frame_count, 4)` per case.

- [ ] **Step 2: Implement the sequential runner**

For each unfinished case in case-id order:

1. POST `{ params, lockedAsset: undefined }` to production.
2. Record `started_at`, `completed_at`, `duration_ms`, HTTP status, error type, model from `/api/health`, and response structured prompt.
3. Decode every returned data URL into the exact template literal ``outputs/${caseItem.case_id}/${runId}-original-${frameIndex + 1}.${extension}``.
4. Resize with nearest-neighbor to the target size and save the exact template literal ``outputs/${caseItem.case_id}/${runId}-target-${frameIndex + 1}.png``.
5. Run deterministic hard checks and append the attempt atomically to `runs.jsonl` before the next request.
6. Resume by skipping any case with a successful recorded attempt.

- [ ] **Step 3: Run the six-category Smoke Test**

```bash
npm run eval:smoke
```

Select the first case of each category. Expected: six cases recorded; every failure retained. Stop and diagnose only if the runner itself cannot record or resume.

- [ ] **Step 4: Run the full baseline**

```bash
npm run eval:baseline
```

Expected: all 48 fixed cases have a terminal successful attempt or retained terminal failure, and the image counter never exceeds 120.

- [ ] **Step 5: Commit the runner, not the raw outputs**

```bash
git add -- evaluation/v0.1/run-generation.ts .gitignore
git commit -m "feat: add resumable Seedream baseline runner"
```

### Task 4: Implement model-assisted scoring

**Files:**
- Create: `evaluation/v0.1/score-results.ts`
- Runtime: `evaluation/v0.1/scores.jsonl`

**Interfaces:**
- Consumes: target-size frames from successful run records and `OPENAI_API_KEY`.
- Produces: one `auto_rater` JSONL score per successful case, with six rubric scores, visual hard flags, rationale, model id, and response id.

- [ ] **Step 1: Build contact sheets**

Compose multi-frame target PNGs left-to-right on a checkerboard, scaling nearest-neighbor to remain legible. Static assets use one frame. Never alter the stored evaluation frames.

- [ ] **Step 2: Call the Responses API with strict JSON Schema**

Default `EVAL_JUDGE_MODEL` to `gpt-5.2`. Send the case prompt, expected category/style/palette/size/frame count, rubric anchors, and contact-sheet data URL. Require integer scores 1–5 for semantic restoration, style match, palette consistency, small-size readability, and game-pipeline usability; use 0 only for static multi-frame consistency. Also require boolean `text_or_watermark`, `obvious_crop`, and `unparseable_or_blank` fields.

- [ ] **Step 3: Make scoring resumable and honest**

Append each response to `scores.jsonl`; skip already-scored cases; retry connection/429/5xx once. Set `rater_id` to the exact template literal ``auto-openai-${judgeModel}`` and `rater_type=auto_model`. If OpenAI remains unreachable, retain deterministic results and report soft scoring as externally blocked rather than fabricating scores.

- [ ] **Step 4: Run scoring**

```bash
node --env-file='/Users/shizhongzhi/Documents/七牛云/.env.local' ./node_modules/.bin/tsx evaluation/v0.1/score-results.ts
```

Expected: one score for each successful baseline case, or an explicit connection-blocked record.

### Task 5: Complete functional checks and build the report

**Files:**
- Create: `evaluation/v0.1/functional-checks.csv`
- Create: `evaluation/v0.1/user-test-template.md`
- Create: `evaluation/v0.1/build-report.ts`
- Generate: `evaluation/v0.1/runs.csv`
- Generate: `evaluation/v0.1/scores.csv`
- Generate: `evaluation/v0.1/report.md`

**Interfaces:**
- Consumes: run records, automatic scores, production Smoke evidence, and observed functional outcomes.
- Produces: plan-aligned KPI tables, weakest slices, issue list, and limitations.

- [ ] **Step 1: Record all 12 functional checks**

Use `pass`, `fail`, `partial`, or `blocked` plus evidence. Include the already observed facts: guest generation works; Supabase auth is unreachable; 64×64 PNG/JSON/ZIP are non-empty; PNG has an RGBA channel but zero transparent pixels; Web ZIP files start at `assets/` while metadata declares `public/assets/`; and no `/api/library` request occurs for guests. Use Playwright for remaining parameter, viewport, engine ZIP, and error-display checks.

- [ ] **Step 2: Implement KPI aggregation tests and report builder**

Test exact formulas for request success rate, hard-parameter pass rate, usable asset rate, median, and P95. `usable` requires every key hard check plus automatic soft mean ≥4.0; when soft scoring is blocked, report usable rate as unavailable rather than treating missing values as zero.

- [ ] **Step 3: Generate final artifacts**

```bash
npm run eval:report
```

Expected: CSV files preserve every attempt and score; `report.md` includes thresholds, overall and category/style slices, worst cases, costs, functional failures, and a distinct “not yet measured” section for five-person user testing.

- [ ] **Step 4: Verify the completed evaluator**

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Expected: all commands pass; no original output image is staged.

- [ ] **Step 5: Commit evaluator code and shareable result artifacts**

```bash
git add -- evaluation/v0.1 package.json package-lock.json .gitignore docs/superpowers/plans/2026-08-03-spritecraft-automated-evaluation.md
git reset -- evaluation/v0.1/outputs evaluation/v0.1/runs.jsonl evaluation/v0.1/scores.jsonl
git diff --cached --check
git commit -m "feat: add SpriteCraft automated evaluation baseline"
```

Expected: committed code, frozen cases, CSVs, templates, and report; local raw images and resumable state remain uncommitted.
