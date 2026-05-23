import { Cloud, Download, FolderInput, Sparkles } from 'lucide-react'

interface TopBarProps {
  statusLabel: string
}

export function TopBar({ statusLabel }: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-lockup">
        <div className="brand-mark">
          <Sparkles size={18} strokeWidth={2.4} />
        </div>
        <div>
          <h1>SpriteCraft Studio</h1>
          <span>Forest Jam Kit</span>
        </div>
      </div>

      <div className="top-actions" aria-label="Project actions">
        <div className="api-pill is-ready">
          <Cloud size={15} />
          <span>{statusLabel}</span>
        </div>
        <button type="button" className="icon-button" title="Import project">
          <FolderInput size={17} />
        </button>
        <button type="button" className="icon-button" title="Export workspace">
          <Download size={17} />
        </button>
      </div>
    </header>
  )
}
