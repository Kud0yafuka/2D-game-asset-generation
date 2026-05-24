import { CheckCircle2, Clock3, RotateCcw, XCircle } from 'lucide-react'
import type { GenerationTask } from '../types'

interface QueuePanelProps {
  tasks: GenerationTask[]
  onRetry: () => void
}

const statusIcon = {
  queued: Clock3,
  running: RotateCcw,
  done: CheckCircle2,
  failed: XCircle,
}

export function QueuePanel({ tasks, onRetry }: QueuePanelProps) {
  return (
    <section className="queue-panel" aria-label="Generation queue">
      <div className="queue-header">
        <h2>Generation Queue</h2>
        <button type="button" className="text-button" onClick={onRetry}>
          <RotateCcw size={14} />
          Retry last
        </button>
      </div>
      <div className="queue-list">
        {tasks.slice(0, 6).map((task) => {
          const Icon = statusIcon[task.status]
          return (
            <div className={`queue-row is-${task.status}`} key={task.id}>
              <Icon size={16} />
              <strong>{task.label}</strong>
              <span>{task.message}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
