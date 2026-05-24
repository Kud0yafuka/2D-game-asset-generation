import { BadgeCheck, Code2, MonitorPlay } from 'lucide-react'

const reviewItems = [
  {
    icon: BadgeCheck,
    label: 'Product',
    score: '40%',
    detail: 'Prompt, generation, preview, Style Lock, export',
  },
  {
    icon: Code2,
    label: 'Process',
    score: '40%',
    detail: '6 staged PRs, typed modules, runnable main',
  },
  {
    icon: MonitorPlay,
    label: 'Demo',
    score: '20%',
    detail: 'Mock-safe flow, OpenAI path, engine handoff',
  },
]

export function SubmissionPanel() {
  return (
    <section className="submission-panel" aria-label="Submission readiness">
      <div className="panel-heading">
        <div>
          <h2>Submission Ready</h2>
          <span>Final review map</span>
        </div>
      </div>
      <div className="review-grid">
        {reviewItems.map((item) => {
          const Icon = item.icon
          return (
            <article className="review-card" key={item.label}>
              <div>
                <Icon size={16} />
                <strong>{item.label}</strong>
              </div>
              <b>{item.score}</b>
              <span>{item.detail}</span>
            </article>
          )
        })}
      </div>
    </section>
  )
}
