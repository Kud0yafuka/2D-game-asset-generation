import { useEffect, useMemo, useState } from 'react'
import { AssetGrid } from './components/AssetGrid'
import { ControlsPanel } from './components/ControlsPanel'
import { InspectorPanel } from './components/InspectorPanel'
import { PreviewStage } from './components/PreviewStage'
import { QueuePanel } from './components/QueuePanel'
import { Sidebar } from './components/Sidebar'
import { TopBar } from './components/TopBar'
import { assetCategories, getCategory } from './data/catalog'
import { initialAssets } from './data/initialAssets'
import { fetchApiHealth, generateOpenAiAssets } from './services/apiGeneration'
import { generateMockAssets } from './services/mockGeneration'
import type {
  ApiHealth,
  AssetCategoryId,
  EngineTarget,
  GameAsset,
  GenerationMode,
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

const bootTasks: GenerationTask[] = [
  {
    id: 'boot-1',
    label: 'Demo kit seeded',
    status: 'done',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    message: '4 sample assets ready',
  },
]

function App() {
  const [activeCategory, setActiveCategory] = useState<AssetCategoryId>('character')
  const [params, setParams] = useState<GenerationParams>(initialParams)
  const [assets, setAssets] = useState<GameAsset[]>(initialAssets)
  const [selectedId, setSelectedId] = useState(initialAssets[0]?.id)
  const [previewMode, setPreviewMode] = useState<PreviewMode>('single')
  const [generationMode, setGenerationMode] = useState<GenerationMode>('mock')
  const [tasks, setTasks] = useState<GenerationTask[]>(bootTasks)
  const [isGenerating, setIsGenerating] = useState(false)
  const [engineTarget, setEngineTarget] = useState<EngineTarget>('godot')
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null)

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

  useEffect(() => {
    fetchApiHealth()
      .then(setApiHealth)
      .catch(() => setApiHealth({ hasKey: false, model: 'unavailable' }))
  }, [])

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
      message:
        prompt.length < 4
          ? 'Prompt needs more detail'
          : generationMode === 'openai'
            ? 'Contacting OpenAI image model'
          : params.styleLock && selectedAsset
            ? `Using style lock from ${selectedAsset.name}`
            : 'Generating local candidates',
    }

    setTasks((current) => [task, ...current])
    if (prompt.length < 4) {
      return
    }

    setIsGenerating(true)
    const result =
      generationMode === 'openai'
        ? await generateOpenAiAssets(params, selectedAsset)
        : await generateMockAssets(params, selectedAsset, generationMode)
    const generatedAssets = result.assets

    setAssets((current) => [...generatedAssets, ...current])
    setSelectedId(generatedAssets[0]?.id)
    setActiveCategory(params.categoryId)
    setTasks((current) =>
      current.map((item) =>
        item.id === taskId
          ? {
              ...item,
              status: result.fallback && generationMode === 'openai' ? 'failed' : 'done',
              completedAt: new Date().toISOString(),
              message: `${generatedAssets.length} assets ready / ${result.message}`,
            }
          : item,
      ),
    )
    setIsGenerating(false)
  }

  function retryLast() {
    if (!isGenerating) {
      void runGeneration()
    }
  }

  return (
    <div className="app-shell">
      <TopBar statusLabel={generationMode === 'openai' ? apiHealth?.model ?? 'API checking' : 'PR4 API ready'} />
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
            mode={generationMode}
            isGenerating={isGenerating}
            onParamsChange={updateParams}
            onModeChange={setGenerationMode}
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
