import { useEffect, useMemo, useState } from 'react'
import { AssetGrid } from './components/AssetGrid'
import { AuthPanel } from './components/AuthPanel'
import { ControlsPanel } from './components/ControlsPanel'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewStage } from './components/PreviewStage'
import { QueuePanel } from './components/QueuePanel'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { assetCategories, getCategory } from './data/catalog'
import { generateOpenAiAssets } from './services/apiGeneration'
import { listCloudAssets, saveGeneratedAssets, updateCloudFavorite } from './services/cloudLibrary'
import { isSupabaseConfigured, supabase } from './services/supabaseClient'
import type {
  AssetCategoryId,
  EngineTarget,
  GameAsset,
  GenerationParams,
  GenerationTask,
  PreviewMode,
} from './types'
import type { Session } from '@supabase/supabase-js'
import './App.css'

const initialParams: GenerationParams = {
  categoryId: 'character',
  prompt: getCategory('character').defaultPrompt,
  styleId: 'pixel',
  size: '128x128',
  frameCount: 4,
  paletteId: 'forest',
  seed: 'forest-jam-01',
  transparent: true,
  styleLock: false,
}

function paramsFromAsset(asset: GameAsset, current: GenerationParams): GenerationParams {
  return {
    ...current,
    categoryId: asset.categoryId,
    prompt: asset.prompt,
    styleId: asset.styleId,
    size: asset.size,
    frameCount: asset.frameCount,
    paletteId: asset.paletteId,
    seed: asset.seed,
  }
}

function App() {
  const [activeCategory, setActiveCategory] = useState<AssetCategoryId>('character')
  const [params, setParams] = useState<GenerationParams>(initialParams)
  const [categoryPromptDrafts, setCategoryPromptDrafts] = useState<Record<string, string>>({})
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [previewMode, setPreviewMode] = useState<PreviewMode>('single')
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [engineTarget, setEngineTarget] = useState<EngineTarget>('godot')
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [syncMessage, setSyncMessage] = useState(
    isSupabaseConfigured
      ? '登录用于云端保存；游客模式可直接生成和导出。'
      : '云端保存未配置；游客模式仍可生成、预览和导出。',
  )

  const user = session?.user
  const accessToken = session?.access_token

  const visibleAssets = useMemo(() => {
    if (activeCategory === 'history') {
      return assets
    }
    return assets.filter((asset) => asset.categoryId === activeCategory)
  }, [activeCategory, assets])

  const selectedAsset = useMemo(() => {
    const selected = selectedId ? visibleAssets.find((asset) => asset.id === selectedId) : undefined
    return selected ?? visibleAssets[0]
  }, [selectedId, visibleAssets])

  const counts = useMemo(() => {
    const base: Record<AssetCategoryId, number> = {
      character: 0,
      monster: 0,
      prop: 0,
      tile: 0,
      ui: 0,
      effect: 0,
      history: assets.length,
    }
    assets.forEach((asset) => {
      base[asset.categoryId] += 1
    })
    return base
  }, [assets])

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true)
      return
    }

    let isMounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return
      }

      setSession(data.session)
      setAuthReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authReady) {
      return
    }

    if (!supabase) {
      setSyncMessage('云端保存未配置；游客模式仍可生成、预览和导出。')
      return
    }

    if (!accessToken) {
      setAssets([])
      setSelectedId(undefined)
      setSyncMessage('登录用于云端保存；游客模式可直接生成和导出。')
      return
    }

    let isMounted = true
    setSyncMessage('正在加载云端素材库...')

    listCloudAssets(accessToken)
      .then((cloudAssets) => {
        if (!isMounted) {
          return
        }

        setAssets(cloudAssets)
        setSelectedId(cloudAssets[0]?.id)
        if (cloudAssets[0]) {
          setParams((current) => paramsFromAsset(cloudAssets[0], current))
          setActiveCategory(cloudAssets[0].categoryId)
          setPreviewMode(cloudAssets[0].frames.length > 1 ? 'sheet' : 'single')
        } else {
          setParams(initialParams)
        }
        setSyncMessage(`${cloudAssets.length} 个素材已从云端恢复。`)
      })
      .catch((error) => {
        if (!isMounted) {
          return
        }

        setSyncMessage(error instanceof Error ? `云端素材加载失败：${error.message}` : '云端素材加载失败')
      })

    return () => {
      isMounted = false
    }
  }, [accessToken, authReady])

  function promptForCategory(nextId: Exclude<AssetCategoryId, 'history'>) {
    return categoryPromptDrafts[nextId] ?? getCategory(nextId).defaultPrompt
  }

  function syncParamsToAsset(asset: GameAsset) {
    setParams((current) => paramsFromAsset(asset, current))
  }

  function syncParamsToEmptyCategory(nextId: Exclude<AssetCategoryId, 'history'>) {
    const category = getCategory(nextId)

    setParams((current) => ({
      ...current,
      categoryId: category.id,
      prompt: promptForCategory(category.id),
      frameCount: category.recommendedFrames,
      size: category.recommendedSize,
    }))
  }

  function selectAsset(asset: GameAsset) {
    setSelectedId(asset.id)
    setPreviewMode(asset.frames.length > 1 ? 'sheet' : 'single')
    syncParamsToAsset(asset)
  }

  function selectCategoryFirstAsset(nextId: AssetCategoryId) {
    const nextAsset = nextId === 'history' ? assets[0] : assets.find((asset) => asset.categoryId === nextId)
    setSelectedId(nextAsset?.id)
    setPreviewMode(nextAsset?.frames.length && nextAsset.frames.length > 1 ? 'sheet' : 'single')

    if (nextAsset) {
      syncParamsToAsset(nextAsset)
      return
    }

    if (nextId !== 'history') {
      syncParamsToEmptyCategory(nextId)
    }
  }

  function updateActiveCategory(nextId: AssetCategoryId) {
    setActiveCategory(nextId)
    selectCategoryFirstAsset(nextId)
  }

  function updateParams(nextParams: GenerationParams) {
    if (nextParams.categoryId !== params.categoryId) {
      const category = getCategory(nextParams.categoryId)
      const nextAsset = assets.find((asset) => asset.categoryId === category.id)

      if (nextAsset) {
        setParams(paramsFromAsset(nextAsset, nextParams))
      } else {
        setParams({
          ...nextParams,
          prompt: promptForCategory(category.id),
          frameCount: category.recommendedFrames,
          size: category.recommendedSize,
        })
      }

      setActiveCategory(nextParams.categoryId)
      selectCategoryFirstAsset(nextParams.categoryId)
      return
    }

    if (nextParams.prompt !== params.prompt) {
      if (selectedAsset) {
        setAssets((current) =>
          current.map((asset) => (asset.id === selectedAsset.id ? { ...asset, prompt: nextParams.prompt } : asset)),
        )
      } else {
        setCategoryPromptDrafts((current) => ({
          ...current,
          [nextParams.categoryId]: nextParams.prompt,
        }))
      }
    }

    setParams(nextParams)
    setActiveCategory(nextParams.categoryId)
  }

  function toggleFavorite(assetId: string) {
    const asset = assets.find((item) => item.id === assetId)
    const nextFavorite = !asset?.favorite

    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, favorite: !asset.favorite } : asset)),
    )

    if (accessToken) {
      updateCloudFavorite(accessToken, assetId, nextFavorite).catch((error) => {
        setSyncMessage(error instanceof Error ? `收藏同步失败：${error.message}` : '收藏同步失败')
      })
    }
  }

  async function runGeneration() {
    const taskId = `task-${Date.now()}`
    const category = getCategory(params.categoryId)
    const prompt = params.prompt.trim()
    const task: GenerationTask = {
      id: taskId,
      label: `${category.shortLabel} / ${params.frameCount} frames`,
      status: prompt.length < 4 ? 'failed' : 'running',
      startedAt: new Date().toISOString(),
      completedAt: prompt.length < 4 ? new Date().toISOString() : undefined,
      message: prompt.length < 4 ? '素材描述需要更具体' : '正在调用 Doubao Seedream 生成真实素材',
    }

    setTasks((current) => [task, ...current])
    if (prompt.length < 4) {
      return
    }

    setIsGenerating(true)
    try {
      const result = await generateOpenAiAssets(params, selectedAsset)
      const generatedAssets = result.assets
      let finalAssets = generatedAssets
      let cloudSaved = false

      if (accessToken) {
        setTasks((current) =>
          current.map((item) =>
            item.id === taskId
              ? {
                  ...item,
                  message: '正在保存到云端素材库',
                }
              : item,
          ),
        )

        try {
          finalAssets = await saveGeneratedAssets(accessToken, generatedAssets)
          cloudSaved = true
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
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: 'done',
                completedAt: new Date().toISOString(),
                message: cloudSaved
                  ? `${finalAssets.length} 个 Doubao Seedream 素材已生成并保存`
                  : accessToken
                    ? `${finalAssets.length} 个 Doubao Seedream 素材已生成，云端保存失败`
                    : `${finalAssets.length} 个 Doubao Seedream 素材已生成（游客模式）`,
              }
            : item,
        ),
      )
    } catch (error) {
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: 'failed',
                completedAt: new Date().toISOString(),
                message: error instanceof Error ? error.message : 'Doubao Seedream 生成失败',
              }
            : item,
        ),
      )
    } finally {
      setIsGenerating(false)
    }
  }

  async function signIn(email: string, password: string) {
    if (!supabase) {
      throw new Error('Supabase 未配置')
    }

    setAuthBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        throw error
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function signUp(email: string, password: string) {
    if (!supabase) {
      throw new Error('Supabase 未配置')
    }

    setAuthBusy(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })

      if (error) {
        throw error
      }

      setSyncMessage(data.session ? '注册成功，素材会自动同步到云端。' : '注册成功，请完成邮箱验证后登录。')
    } finally {
      setAuthBusy(false)
    }
  }

  async function signOut() {
    if (!supabase) {
      return
    }

    setAuthBusy(true)
    try {
      await supabase.auth.signOut()
      setAssets([])
      setSelectedId(undefined)
      setSyncMessage('已退出。登录后可恢复你的云端素材库。')
    } finally {
      setAuthBusy(false)
    }
  }

  function retryLast() {
    if (!isGenerating) {
      void runGeneration()
    }
  }

  return (
    <div className="app-shell">
      <TopBar>
        <AuthPanel
          email={user?.email}
          isConfigured={isSupabaseConfigured}
          isBusy={authBusy || !authReady}
          message={syncMessage}
          onSignIn={signIn}
          onSignUp={signUp}
          onSignOut={signOut}
        />
      </TopBar>
      <div className="editor-layout">
        <Sidebar activeId={activeCategory} counts={counts} onSelect={updateActiveCategory} />

        <main className="workspace">
          <PreviewStage asset={selectedAsset} mode={previewMode} onModeChange={setPreviewMode} />
          <section className="library-panel">
            <div className="panel-heading">
              <div>
                <h2>{activeCategory === 'history' ? 'History' : getCategory(activeCategory).label}</h2>
                <span>{visibleAssets.length} assets</span>
              </div>
              <div className="asset-family-pills">
                {assetCategories.slice(0, 4).map((category) => (
                  <button
                    type="button"
                    key={category.id}
                    className={params.categoryId === category.id ? 'is-active' : ''}
                    onClick={() => updateActiveCategory(category.id)}
                  >
                    {category.shortLabel}
                  </button>
                ))}
              </div>
            </div>
            <AssetGrid
              assets={visibleAssets}
              selectedId={selectedAsset?.id}
              onSelect={selectAsset}
              onToggleFavorite={toggleFavorite}
            />
          </section>
          <QueuePanel tasks={tasks} onRetry={retryLast} />
        </main>

        <aside className="right-rail">
          <ControlsPanel
            params={params}
            isGenerating={isGenerating}
            onParamsChange={updateParams}
            onGenerate={() => void runGeneration()}
          />
          <InspectorPanel
            asset={selectedAsset}
            target={engineTarget}
            onTargetChange={setEngineTarget}
            onToggleFavorite={toggleFavorite}
          />
        </aside>
      </div>
    </div>
  )
}

export default App
