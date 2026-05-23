import { Download, FileJson, Package, Star } from 'lucide-react'
import { engineTargets, getCategory, getPalette, getStyle } from '../data/catalog'
import type { EngineTarget, GameAsset } from '../types'

interface InspectorPanelProps {
  asset: GameAsset | undefined
  target: EngineTarget
  onTargetChange: (target: EngineTarget) => void
  onToggleFavorite: (assetId: string) => void
}

export function InspectorPanel({ asset, target, onTargetChange, onToggleFavorite }: InspectorPanelProps) {
  const palette = asset ? getPalette(asset.paletteId) : undefined

  return (
    <section className="inspector-panel" aria-label="Asset inspector">
      <div className="panel-heading">
        <div>
          <h2>Inspector</h2>
          <span>{asset ? getCategory(asset.categoryId).description : 'No asset selected'}</span>
        </div>
        {asset && (
          <button
            type="button"
            className={`icon-button ${asset.favorite ? 'is-favorite' : ''}`}
            onClick={() => onToggleFavorite(asset.id)}
            title="Favorite asset"
          >
            <Star size={16} fill={asset.favorite ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {asset ? (
        <>
          <dl className="details-list">
            <div>
              <dt>Name</dt>
              <dd>{asset.name}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{getStyle(asset.styleId).label}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{asset.size}</dd>
            </div>
            <div>
              <dt>Frames</dt>
              <dd>{asset.frameCount}</dd>
            </div>
            <div>
              <dt>Seed</dt>
              <dd>{asset.seed}</dd>
            </div>
            <div>
              <dt>Usage</dt>
              <dd>{asset.usage}</dd>
            </div>
          </dl>

          <div className="tag-list">
            {asset.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>

          {palette && (
            <div className="palette-strip">
              {palette.colors.map((color) => (
                <span style={{ background: color }} key={color} />
              ))}
            </div>
          )}

          <label className="field">
            <span>Engine</span>
            <select value={target} onChange={(event) => onTargetChange(event.target.value as EngineTarget)}>
              {engineTargets.map((engine) => (
                <option value={engine.id} key={engine.id}>
                  {engine.label} - {engine.root}
                </option>
              ))}
            </select>
          </label>

          <div className="export-grid">
            <button type="button" disabled>
              <Download size={15} />
              PNG
            </button>
            <button type="button" disabled>
              <Package size={15} />
              Sheet
            </button>
            <button type="button" disabled>
              <FileJson size={15} />
              JSON
            </button>
            <button type="button" disabled>
              <Package size={15} />
              ZIP
            </button>
          </div>
        </>
      ) : (
        <div className="empty-state compact">
          <strong>No selection</strong>
        </div>
      )}
    </section>
  )
}
