import { WandSparkles } from 'lucide-react'
import {
  assetCategories,
  assetSizes,
  getCategory,
  palettePresets,
  stylePresets,
} from '../data/catalog'
import type { AssetSize, GenerationMode, GenerationParams } from '../types'

interface ControlsPanelProps {
  params: GenerationParams
  mode: GenerationMode
  isGenerating: boolean
  onParamsChange: (params: GenerationParams) => void
  onModeChange: (mode: GenerationMode) => void
  onGenerate: () => void
}

export function ControlsPanel({
  params,
  mode,
  isGenerating,
  onParamsChange,
  onModeChange,
  onGenerate,
}: ControlsPanelProps) {
  const category = getCategory(params.categoryId)

  return (
    <section className="controls-panel" aria-label="Generation controls">
      <div className="panel-heading">
        <div>
          <h2>Generate</h2>
          <span>{category.description}</span>
        </div>
      </div>

      <label className="field">
        <span>Prompt</span>
        <textarea
          value={params.prompt}
          onChange={(event) => onParamsChange({ ...params, prompt: event.target.value })}
          rows={5}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Family</span>
          <select
            value={params.categoryId}
            onChange={(event) => {
              const nextCategory = getCategory(event.target.value as GenerationParams['categoryId'])
              onParamsChange({
                ...params,
                categoryId: nextCategory.id,
                frameCount: nextCategory.recommendedFrames,
                size: nextCategory.recommendedSize,
              })
            }}
          >
            {assetCategories.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Style</span>
          <select
            value={params.styleId}
            onChange={(event) => onParamsChange({ ...params, styleId: event.target.value })}
          >
            {stylePresets.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Size</span>
          <select
            value={params.size}
            onChange={(event) => onParamsChange({ ...params, size: event.target.value as AssetSize })}
          >
            {assetSizes.map((size) => (
              <option value={size} key={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Frames</span>
          <input
            type="number"
            min={1}
            max={8}
            value={params.frameCount}
            onChange={(event) =>
              onParamsChange({
                ...params,
                frameCount: Math.max(1, Math.min(8, Number(event.target.value))),
              })
            }
          />
        </label>
      </div>

      <label className="field">
        <span>Palette</span>
        <select
          value={params.paletteId}
          onChange={(event) => onParamsChange({ ...params, paletteId: event.target.value })}
        >
          {palettePresets.map((palette) => (
            <option value={palette.id} key={palette.id}>
              {palette.label}
            </option>
          ))}
        </select>
      </label>

      <div className="palette-strip" aria-label="Current palette">
        {palettePresets
          .find((palette) => palette.id === params.paletteId)
          ?.colors.map((color) => <span style={{ background: color }} key={color} />)}
      </div>

      <label className="field">
        <span>Seed</span>
        <input
          value={params.seed}
          onChange={(event) => onParamsChange({ ...params, seed: event.target.value })}
        />
      </label>

      <div className="toggle-grid">
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.styleLock}
            onChange={(event) => onParamsChange({ ...params, styleLock: event.target.checked })}
          />
          <span>Style Lock</span>
        </label>
        <label className="toggle-row">
          <input
            type="checkbox"
            checked={params.transparent}
            onChange={(event) => onParamsChange({ ...params, transparent: event.target.checked })}
          />
          <span>Transparent</span>
        </label>
      </div>

      <div className="mode-switch">
        <button
          type="button"
          className={mode === 'openai' ? 'is-active' : ''}
          onClick={() => onModeChange('openai')}
        >
          OpenAI
        </button>
        <button
          type="button"
          className={mode === 'mock' ? 'is-active' : ''}
          onClick={() => onModeChange('mock')}
        >
          Mock
        </button>
        <button type="button" className={mode === 'demo' ? 'is-active' : ''} onClick={() => onModeChange('demo')}>
          Demo
        </button>
      </div>

      <button type="button" className="primary-action" onClick={onGenerate} disabled={isGenerating}>
        <WandSparkles size={17} />
        {isGenerating ? 'Generating...' : 'Generate Assets'}
      </button>
    </section>
  )
}
