import { Sparkles } from 'lucide-react'

export function TopBar() {
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
    </header>
  )
}
