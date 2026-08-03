# SpriteCraft Studio Guest Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the production guest workflow so an unauthenticated user can generate, preview, and export assets while cloud persistence remains conditional on a valid Supabase session.

**Architecture:** Keep `/api/generate` and the export pipeline unchanged. Move cloud persistence behind an optional `accessToken` branch in `App.runGeneration()`, preserve generated assets when Supabase is unavailable, and make the controls independent of authentication state. Add focused React regression tests before implementation, then deploy from an isolated branch based on `origin/main`.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest, React Testing Library, Supabase JS, Express, GitHub CLI, Render.

## Global Constraints

- Do not stage or modify unrelated files in `/Users/shizhongzhi/Documents/七牛云`.
- Build the implementation in an isolated worktree created from `origin/main`.
- Never replace Seedream failures with local or mock images.
- Guest assets are memory-only; browser persistence is out of scope.
- Supabase authentication remains visible but must not gate generation, preview, or local export.
- A cloud-save failure must preserve the generated asset and show an explicit degraded-state message.
- Deployment is complete only after the production URL passes an unauthenticated real-generation Smoke Test.

---

## File Structure

- `package.json`: add the unit-test command and test-only dependencies.
- `package-lock.json`: lock the test dependency versions installed by npm.
- `vitest.config.ts`: configure jsdom and the common test setup.
- `src/test/setup.ts`: install Testing Library DOM matchers.
- `src/App.test.tsx`: cover guest generation and cloud-save degradation.
- `src/App.tsx`: make generation unconditional on auth and cloud persistence conditional.
- `src/components/ControlsPanel.tsx`: remove auth-derived disabling props and copy.
- `src/components/AuthPanel.tsx`: describe login as optional cloud persistence.
- `docs/ai2d-product-evaluation-execution-addendum-v0.1.md`: freeze the pre-baseline FUN-001 decision without rewriting the original plan.

### Task 1: Create an isolated implementation worktree

**Files:**
- Reference: `docs/superpowers/specs/2026-08-03-spritecraft-guest-evaluation-design.md`

**Interfaces:**
- Consumes: GitHub `origin/main` at the current deployed source revision.
- Produces: an isolated `codex/guest-evaluation` branch and worktree path used by every later task.

- [ ] **Step 1: Inspect existing worktrees and branches**

Run:

```bash
git worktree list
git branch --list 'codex/guest-evaluation'
git ls-remote --heads origin main
```

Expected: the current mixed worktree is listed, the feature branch is absent, and `origin/main` resolves to a commit.

- [ ] **Step 2: Create the isolated worktree from the remote main commit**

Run through the `using-git-worktrees` skill after validating that `/Users/shizhongzhi/Documents/七牛云-guest-evaluation` does not already exist, then:

```bash
git worktree add '/Users/shizhongzhi/Documents/七牛云-guest-evaluation' -b codex/guest-evaluation origin/main
```

Expected: the new worktree is clean and `git status --short` returns no output.

- [ ] **Step 3: Copy the approved design and this plan into the isolated branch**

Use `apply_patch` in the isolated worktree to create the two documents with the exact committed contents from commit `6c02525` and this plan. Do not copy any other file from the mixed worktree.

- [ ] **Step 4: Commit only the planning artifacts**

```bash
git add -- docs/superpowers/specs/2026-08-03-spritecraft-guest-evaluation-design.md docs/superpowers/plans/2026-08-03-spritecraft-guest-mode.md
git diff --cached --check
git commit -m "docs: plan guest evaluation workflow"
```

Expected: one documentation-only commit and a clean isolated worktree.

### Task 2: Add failing guest-mode regression tests

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`

**Interfaces:**
- Consumes: `App` as the production root component and existing service module exports.
- Produces: `npm test`, with mocks for `generateOpenAiAssets`, `listCloudAssets`, `saveGeneratedAssets`, and the Supabase session API.

- [ ] **Step 1: Install the minimal test harness**

Run:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add to `package.json` scripts:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write the failing guest tests**

Create `src/App.test.tsx`:

```ts
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import type { GameAsset } from './types'

const mocks = vi.hoisted(() => ({
  currentSession: null as Session | null,
  generateOpenAiAssets: vi.fn(),
  listCloudAssets: vi.fn(),
  saveGeneratedAssets: vi.fn(),
  updateCloudFavorite: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./services/apiGeneration', () => ({
  generateOpenAiAssets: mocks.generateOpenAiAssets,
}))

vi.mock('./services/cloudLibrary', () => ({
  listCloudAssets: mocks.listCloudAssets,
  saveGeneratedAssets: mocks.saveGeneratedAssets,
  updateCloudFavorite: mocks.updateCloudFavorite,
}))

vi.mock('./services/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: mocks.currentSession } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } })),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
  },
}))

const generatedAsset: GameAsset = {
  id: 'seedream-test-1',
  name: '道具-绿色治疗药水瓶-1',
  categoryId: 'character',
  prompt: '绿色治疗药水瓶，清晰轮廓，禁止文字',
  styleId: 'pixel',
  paletteId: 'forest',
  size: '128x128',
  frameCount: 1,
  seed: 'guest-test',
  imageSrc: 'data:image/png;base64,iVBORw0KGgo=',
  frames: ['data:image/png;base64,iVBORw0KGgo='],
  createdAt: '2026-08-03T00:00:00.000Z',
  source: 'seedream',
  tags: ['道具', '像素风', '森林', '1 frames'],
  favorite: false,
  usage: 'Generated test asset',
}

const signedInSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'test-user', email: 'tester@example.com' },
} as Session

describe('guest generation workflow', () => {
  beforeEach(() => {
    mocks.currentSession = null
    mocks.generateOpenAiAssets.mockReset()
    mocks.listCloudAssets.mockReset().mockResolvedValue([])
    mocks.saveGeneratedAssets.mockReset()
    mocks.updateCloudFavorite.mockReset()
    mocks.unsubscribe.mockReset()
  })

it('allows a guest to generate without calling cloud persistence', async () => {
  mocks.currentSession = null
  mocks.generateOpenAiAssets.mockResolvedValue({ assets: [generatedAsset] })

  render(<App />)
  const generateButton = await screen.findByRole('button', { name: '生成素材' })
  await waitFor(() => expect(generateButton).toBeEnabled())

  await userEvent.click(generateButton)

  expect(await screen.findByText(generatedAsset.name)).toBeInTheDocument()
  expect(mocks.generateOpenAiAssets).toHaveBeenCalledTimes(1)
  expect(mocks.saveGeneratedAssets).not.toHaveBeenCalled()
})

it('preserves generated assets when cloud persistence fails', async () => {
  mocks.currentSession = signedInSession
  mocks.listCloudAssets.mockResolvedValue([])
  mocks.generateOpenAiAssets.mockResolvedValue({ assets: [generatedAsset] })
  mocks.saveGeneratedAssets.mockRejectedValue(new Error('Storage offline'))

  render(<App />)
  await userEvent.click(await screen.findByRole('button', { name: '生成素材' }))

  expect(await screen.findByText(generatedAsset.name)).toBeInTheDocument()
  expect(await screen.findByText(/生成成功，但云端保存失败/)).toBeInTheDocument()
})
})
```

- [ ] **Step 3: Run the tests to verify the regression is red**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: the guest test fails because the generation button is disabled without a session. The cloud-save test may also fail if the current task state reports the save error as a generation failure.

- [ ] **Step 4: Commit the red tests and harness**

```bash
git add -- package.json package-lock.json vitest.config.ts src/test/setup.ts src/App.test.tsx
git diff --cached --check
git commit -m "test: cover guest generation workflow"
```

Expected: test-only commit; production behavior remains unchanged.

### Task 3: Implement optional authentication

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ControlsPanel.tsx`
- Modify: `src/components/AuthPanel.tsx`

**Interfaces:**
- Consumes: `generateOpenAiAssets(params, selectedAsset)` and optional `accessToken`.
- Produces: a guest-capable `runGeneration()` and auth-independent `ControlsPanel` props.

- [ ] **Step 1: Remove auth gating from `ControlsPanel`**

Change its prop interface to:

```ts
interface ControlsPanelProps {
  params: GenerationParams
  isGenerating: boolean
  onParamsChange: (params: GenerationParams) => void
  onGenerate: () => void
}
```

Change the action button to:

```tsx
<button
  type="button"
  className="primary-action"
  onClick={onGenerate}
  disabled={isGenerating}
  title="调用 Doubao Seedream 生成真实 2D 游戏素材"
>
```

Remove the old login-required hint from this component.

- [ ] **Step 2: Make cloud persistence conditional in `App.runGeneration()`**

Remove `missingAuth` from task validation. Keep `prompt.length < 4` as the only local generation guard. After `generateOpenAiAssets` succeeds, use this control flow:

```ts
let finalAssets = generatedAssets

if (accessToken) {
  setTasks((current) =>
    current.map((item) =>
      item.id === taskId ? { ...item, message: '正在保存到云端素材库' } : item,
    ),
  )

  try {
    finalAssets = await saveGeneratedAssets(accessToken, generatedAssets)
    setSyncMessage(`${finalAssets.length} 个新素材已保存到云端。`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误'
    setSyncMessage(`生成成功，但云端保存失败：${detail}`)
  }
} else {
  setSyncMessage('游客模式：素材仅保留在当前页面，可直接预览和导出。')
}

setAssets((current) => [...finalAssets, ...current])
setSelectedId(finalAssets[0]?.id)
setPreviewMode(finalAssets[0]?.frames.length > 1 ? 'sheet' : 'single')
setActiveCategory(params.categoryId)
```

Then mark the task `done` with a message that distinguishes cloud-saved and guest assets. Keep the outer `catch` for Seedream failures only, so a cloud failure never removes or marks the generated asset as failed.

- [ ] **Step 3: Update authentication and guest copy**

Use these meanings consistently:

```text
Signed out: 登录用于云端保存；游客模式可直接生成和导出。
Guest result: 游客模式：素材仅保留在当前页面，可直接预览和导出。
Supabase missing: 云端保存未配置；游客模式仍可生成、预览和导出。
```

In `App`, stop passing `canGenerate` and `disabledMessage` to `ControlsPanel`. In `AuthPanel`, change the signed-out heading from `登录后自动保存` to `登录后云端保存`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: both guest workflow tests pass.

- [ ] **Step 5: Run full local verification**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0; `dist/index.html` is produced.

- [ ] **Step 6: Commit the implementation**

```bash
git add -- src/App.tsx src/components/ControlsPanel.tsx src/components/AuthPanel.tsx
git diff --cached --check
git commit -m "fix: allow guest asset generation"
```

Expected: one focused production commit.

### Task 4: Freeze the pre-baseline evaluation addendum

**Files:**
- Create: `docs/ai2d-product-evaluation-execution-addendum-v0.1.md`

**Interfaces:**
- Consumes: the original v0.1 evaluation plan and approved guest-mode decision.
- Produces: a dated, immutable execution note used by the automated evaluator.

- [ ] **Step 1: Write the addendum**

The document must state:

```markdown
# SpriteCraft Studio 产品评测执行补充 v0.1

- 冻结日期：2026-08-03
- 原方案保持不变，本文件仅记录正式基线前的产品决策。
- FUN-001 新预期：未登录用户可生成、预览和本地导出；界面明确提示素材未云端保存。
- FUN-002 与 FUN-011 仍按原预期检查；Supabase 不可用时记录失败或外部依赖阻断。
- A 层与其余 B 层测试不因认证故障暂停。
- C 层真人数据不得自动生成。
```

Include the observed Supabase hostname failure and the production URL as evidence.

- [ ] **Step 2: Validate and commit the addendum**

```bash
rg -n "TBD|TODO|待定|占位" docs/ai2d-product-evaluation-execution-addendum-v0.1.md
git diff --check
git add -- docs/ai2d-product-evaluation-execution-addendum-v0.1.md
git commit -m "docs: freeze guest evaluation addendum"
```

Expected: the placeholder scan has no matches and the document is committed alone.

### Task 5: Publish and deploy the verified fix

**Files:**
- No new source files.

**Interfaces:**
- Consumes: the clean `codex/guest-evaluation` branch and passing local verification.
- Produces: one GitHub PR merged to `main` and one successful Render deployment.

- [ ] **Step 1: Inspect the exact publish scope**

```bash
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: only planning docs, test harness, guest-mode source changes, and the evaluation addendum appear.

- [ ] **Step 2: Push the feature branch**

```bash
git push -u origin codex/guest-evaluation
```

Expected: exactly one new remote branch; no force push.

- [ ] **Step 3: Create one draft PR and wait for checks**

```bash
gh pr create --draft --base main --head codex/guest-evaluation --title "fix: restore guest generation for evaluation" --body "## Summary
- allow guest generation, preview, and local export
- preserve generated assets when cloud persistence fails
- add guest workflow regression tests and evaluation addendum

## Verification
- npm test
- npm run typecheck
- npm run lint
- npm run build"
guest_pr_number=$(gh pr view --json number --jq .number)
gh pr checks "$guest_pr_number" --watch
```

Expected: one PR; all required GitHub checks pass.

- [ ] **Step 4: Mark ready and merge after verification**

```bash
guest_pr_number=$(gh pr view --json number --jq .number)
gh pr ready "$guest_pr_number"
gh pr merge "$guest_pr_number" --squash --delete-branch
```

Expected: PR merged once to `main`; Render auto-deployment starts.

- [ ] **Step 5: Poll production health and content**

Poll no more frequently than every 15 seconds:

```bash
curl -fsS https://spritecraft-studio.onrender.com/api/health
```

Then open the page with Playwright and snapshot it. Expected: unauthenticated `生成素材` is enabled and the page states that guest mode is available.

### Task 6: Run the production guest Smoke Test

**Files:**
- Create at runtime: `output/playwright/` evidence only in the isolated worktree.

**Interfaces:**
- Consumes: deployed guest mode and one real Seedream request.
- Produces: production screenshots, downloaded artifacts, and a pass/fail record for the evaluator plan.

- [ ] **Step 1: Start a production trace and verify the guest state**

Use the Playwright CLI skill to open the production URL, snapshot the page, and start tracing. Assert that the generation button is enabled without a session.

- [ ] **Step 2: Run one low-cost real generation**

Select `道具`, `像素风`, `64x64`, `1` frame, `森林`, transparent background, and prompt `绿色治疗药水瓶，清晰轮廓，禁止文字`. Start generation and wait conditionally for a completed queue item, with a maximum wait of 240 seconds.

Expected: one real Seedream asset appears; there is no request to `/api/library` and no fake fallback.

- [ ] **Step 3: Export and inspect artifacts**

Download PNG, JSON, and Web ZIP. Verify:

```text
PNG: non-empty and exactly 64x64
JSON: schema equals spritecraft.asset.v1 and frameCount equals 1
ZIP: contains public/assets/spritecraft/sprites, metadata, and README.md
```

- [ ] **Step 4: Capture evidence and finish the trace**

Save the screenshot and trace under `output/playwright/`. Record console errors, elapsed time, and the production response metadata. This evidence becomes the input to the automated evaluation plan.
