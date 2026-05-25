import { WandSparkles } from 'lucide-react'
import {
  assetCategories,
  assetSizes,
  getCategory,
  palettePresets,
  stylePresets,
} from '../data/catalog'
import type { AssetSize, GenerationParams } from '../types'

interface ControlsPanelProps {
  params: GenerationParams
  isGenerating: boolean
  canGenerate: boolean
  disabledMessage: string
  onParamsChange: (params: GenerationParams) => void
  onGenerate: () => void
}

export function ControlsPanel({
  params,
  isGenerating,
  canGenerate,
  disabledMessage,
  onParamsChange,
  onGenerate,
}: ControlsPanelProps) {
  const category = getCategory(params.categoryId)

  return (
    <section className="controls-panel" aria-label="Generation controls">
      <div className="panel-heading">
        <div>
          <h2>生成素材</h2>
          <span>{category.description}</span>
        </div>
      </div>

      <label className="field">
        <span>素材描述</span>
        <textarea
          aria-label="素材描述"
          placeholder="例如：穿蓝色披风的像素风骑士，正面站立，idle 动画，轮廓清晰"
          title="描述你想生成的游戏素材外观、动作、用途和需要避免的问题"
          value={params.prompt}
          onChange={(event) => onParamsChange({ ...params, prompt: event.target.value })}
          rows={5}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>素材类型</span>
          <select
            aria-label="素材类型"
            title="选择角色、怪物、道具、地块、UI 或特效；切换后会自动更新推荐尺寸和帧数"
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
          <span>美术风格</span>
          <select
            aria-label="美术风格"
            title="控制生成结果的整体画风"
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
          <span>输出尺寸</span>
          <select
            aria-label="输出尺寸"
            title="选择单帧素材尺寸；像素素材常用 64x64 或 128x128"
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
          <span>动画帧数</span>
          <input
            aria-label="动画帧数"
            title="静态素材用 1 帧，角色或怪物动画常用 4 帧，特效可用 6 帧"
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
        <span>调色板</span>
        <select
          aria-label="调色板"
          title="选择生成结果的主色倾向"
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
        <span>随机种子</span>
        <input
          aria-label="随机种子"
          placeholder="例如：forest-jam-01"
          title="用于控制可复现性；保留同一个种子更容易得到稳定方向"
          value={params.seed}
          onChange={(event) => onParamsChange({ ...params, seed: event.target.value })}
        />
        <small>用于复现结果和保持同一批素材风格一致；不确定时可保留默认值。</small>
      </label>

      <div className="toggle-grid">
        <label className="toggle-row">
          <input
            aria-label="沿用选中风格"
            type="checkbox"
            checked={params.styleLock}
            onChange={(event) => onParamsChange({ ...params, styleLock: event.target.checked })}
          />
          <span>沿用选中风格</span>
        </label>
        <label className="toggle-row">
          <input
            aria-label="透明背景"
            type="checkbox"
            checked={params.transparent}
            onChange={(event) => onParamsChange({ ...params, transparent: event.target.checked })}
          />
          <span>透明背景</span>
        </label>
      </div>

      <button
        type="button"
        className="primary-action"
        onClick={onGenerate}
        disabled={isGenerating || !canGenerate}
        title="调用 Doubao Seedream 生成真实 2D 游戏素材"
      >
        <WandSparkles size={17} />
        {isGenerating ? '生成中...' : '生成素材'}
      </button>
      {!canGenerate && <p className="panel-hint">{disabledMessage}</p>}
    </section>
  )
}
