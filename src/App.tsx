import { useMemo, useState } from 'react'
import { AssetGrid } from './components/AssetGrid'
import { ControlsPanel } from './components/ControlsPanel'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewStage } from './components/PreviewStage'
import { QueuePanel } from './components/QueuePanel'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { assetCategories, getCategory } from './data/catalog'
import { generateOpenAiAssets } from './services/apiGeneration'
import type {
  AssetCategoryId,
  EngineTarget,
  GameAsset,
  GenerationParams,
  GenerationTask,
  PreviewMode,
} from './types'
import './App.css'

const initialParams: GenerationParams = {
  categoryId: 'character',
  prompt: 'forest ranger with tiny cape and readable idle animation',
  styleId: 'pixel',
  size: '128x128',
  frameCount: 4,
  paletteId: 'forest',
  seed: 'forest-jam-01',
  transparent: true,
  styleLock: false,
}

function App() {
  const [activeCategory, setActiveCategory] = useState<AssetCategoryId>('character')
  const [params, setParams] = useState<GenerationParams>(initialParams)
  const [assets, setAssets] = useState<GameAsset[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [previewMode, setPreviewMode] = useState<PreviewMode>('single')
  const [tasks, setTasks] = useState<GenerationTask[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [engineTarget, setEngineTarget] = useState<EngineTarget>('godot')

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) ?? assets[0],
    [assets, selectedId],
  )

  const visibleAssets = useMemo(() => {
    if (activeCategory === 'history') {
      return assets
    }
    return assets.filter((asset) => asset.categoryId === activeCategory)
  }, [activeCategory, assets])

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

  function updateActiveCategory(nextId: AssetCategoryId) {
    setActiveCategory(nextId)
    if (nextId !== 'history') {
      const category = getCategory(nextId)
      setParams((current) => ({
        ...current,
        categoryId: category.id,
        frameCount: category.recommendedFrames,
        size: category.recommendedSize,
      }))
    }
  }

  function updateParams(nextParams: GenerationParams) {
    setParams(nextParams)
    setActiveCategory(nextParams.categoryId)
  }

  function toggleFavorite(assetId: string) {
    setAssets((current) =>
      current.map((asset) => (asset.id === assetId ? { ...asset, favorite: !asset.favorite } : asset)),
    )
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

      setAssets((current) => [...generatedAssets, ...current])
      setSelectedId(generatedAssets[0]?.id)
      setActiveCategory(params.categoryId)
      setTasks((current) =>
        current.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status: 'done',
                completedAt: new Date().toISOString(),
                message: `${generatedAssets.length} 个 Doubao Seedream 素材已生成`,
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

  function retryLast() {
    if (!isGenerating) {
      void runGeneration()
    }
  }

  return (
    <div className="app-shell">
      <TopBar />
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
              onSelect={(asset) => setSelectedId(asset.id)}
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
