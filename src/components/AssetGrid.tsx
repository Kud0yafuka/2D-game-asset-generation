import { Heart, ImageIcon } from 'lucide-react'
import { getCategory, getStyle } from '../data/catalog'
import type { GameAsset } from '../types'

interface AssetGridProps {
  assets: GameAsset[]
  selectedId: string | undefined
  onSelect: (asset: GameAsset) => void
  onToggleFavorite: (assetId: string) => void
}

export function AssetGrid({ assets, selectedId, onSelect, onToggleFavorite }: AssetGridProps) {
  if (assets.length === 0) {
    return (
      <div className="empty-state">
        <ImageIcon size={28} />
        <strong>还没有真实生成的素材</strong>
        <span>填写右侧参数并点击生成素材后，Doubao Seedream 结果会出现在这里。</span>
      </div>
    )
  }

  return (
    <div className="asset-grid">
      {assets.map((asset) => (
        <button
          type="button"
          key={asset.id}
          className={`asset-card ${selectedId === asset.id ? 'is-selected' : ''}`}
          onClick={() => onSelect(asset)}
        >
          <span className="asset-thumb checker-bg">
            <img src={asset.imageSrc} alt={asset.name} />
          </span>
          <span className="asset-card-meta">
            <strong>{asset.name}</strong>
            <small>
              {getCategory(asset.categoryId).shortLabel} / {getStyle(asset.styleId).label}
            </small>
          </span>
          <span
            role="button"
            tabIndex={0}
            className={`favorite-dot ${asset.favorite ? 'is-on' : ''}`}
            onClick={(event) => {
              event.stopPropagation()
              onToggleFavorite(asset.id)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                event.stopPropagation()
                onToggleFavorite(asset.id)
              }
            }}
            title={asset.favorite ? 'Remove favorite' : 'Favorite asset'}
          >
            <Heart size={14} fill={asset.favorite ? 'currentColor' : 'none'} />
          </span>
        </button>
      ))}
    </div>
  )
}
