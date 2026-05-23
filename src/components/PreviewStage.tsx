import { Film, Grid3X3, Image, Play } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { GameAsset, PreviewMode } from '../types'

interface PreviewStageProps {
  asset: GameAsset | undefined
  mode: PreviewMode
  onModeChange: (mode: PreviewMode) => void
}

const modes: Array<{ id: PreviewMode; label: string; icon: typeof Image }> = [
  { id: 'single', label: 'Single', icon: Image },
  { id: 'sheet', label: 'Sheet', icon: Grid3X3 },
  { id: 'checker', label: 'Alpha', icon: Film },
  { id: 'animation', label: 'Play', icon: Play },
]

export function PreviewStage({ asset, mode, onModeChange }: PreviewStageProps) {
  const [frameIndex, setFrameIndex] = useState(0)
  const activeFrameIndex = mode === 'animation' ? frameIndex : 0
  const frame = asset?.frames[activeFrameIndex % Math.max(asset.frames.length, 1)]
  const sheetColumns = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${asset?.frames.length ?? 1}, minmax(72px, 1fr))`,
    }),
    [asset?.frames.length],
  )

  useEffect(() => {
    if (mode !== 'animation' || !asset || asset.frames.length <= 1) {
      return undefined
    }

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % asset.frames.length)
    }, 260)

    return () => window.clearInterval(interval)
  }, [asset, mode])

  return (
    <section className="preview-panel" aria-label="Asset preview">
      <div className="panel-heading">
        <div>
          <h2>{asset?.name ?? 'Preview'}</h2>
          <span>{asset ? `${asset.size} / ${asset.frameCount} frames / ${asset.source}` : 'Select an asset'}</span>
        </div>
        <div className="segmented-control">
          {modes.map((item) => {
            const Icon = item.icon
            return (
              <button
                type="button"
                key={item.id}
                className={mode === item.id ? 'is-active' : ''}
                onClick={() => onModeChange(item.id)}
                title={item.label}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      </div>

      <div className={`stage ${mode === 'checker' ? 'checker-bg' : ''}`}>
        {!asset && <div className="stage-placeholder">Select or generate an asset</div>}
        {asset && mode !== 'sheet' && (
          <img className={`stage-image ${mode === 'animation' ? 'is-playing' : ''}`} src={frame} alt={asset.name} />
        )}
        {asset && mode === 'sheet' && (
          <div className="sprite-sheet" style={sheetColumns}>
            {asset.frames.map((source, index) => (
              <img src={source} alt={`${asset.name} frame ${index + 1}`} key={source} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
