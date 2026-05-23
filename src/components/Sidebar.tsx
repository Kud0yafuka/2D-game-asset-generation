import {
  Archive,
  Boxes,
  Flame,
  Ghost,
  Grid2X2,
  Swords,
  UserRound,
} from 'lucide-react'
import { navItems } from '../data/catalog'
import type { AssetCategoryId } from '../types'

interface SidebarProps {
  activeId: AssetCategoryId
  counts: Record<AssetCategoryId, number>
  onSelect: (id: AssetCategoryId) => void
}

const icons = {
  character: UserRound,
  monster: Ghost,
  prop: Swords,
  tile: Grid2X2,
  ui: Boxes,
  effect: Flame,
  history: Archive,
}

export function Sidebar({ activeId, counts, onSelect }: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Asset families">
      <nav className="asset-nav">
        {navItems.map((item) => {
          const Icon = icons[item.id]
          return (
            <button
              type="button"
              key={item.id}
              className={`nav-item ${activeId === item.id ? 'is-active' : ''}`}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              <strong>{counts[item.id]}</strong>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
