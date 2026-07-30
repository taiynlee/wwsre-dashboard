import type { CategoryHealth } from '../lib/types'
import { TIER_FILL } from '../lib/tier'

const R = 24
const CIRCUMFERENCE = 2 * Math.PI * R

export function CategoryRings({ categories }: { categories: CategoryHealth[] }) {
  return (
    <div className="flex flex-nowrap justify-between gap-1.5 overflow-x-auto px-3.5 pb-4 pt-2.5">
      {categories.map((cat) => {
        const fraction = Math.max(0, Math.min(1, cat.avg_pct / 100))
        const dash = `${(fraction * CIRCUMFERENCE).toFixed(1)} ${CIRCUMFERENCE.toFixed(1)}`
        const fill = TIER_FILL[cat.tier]
        const label = cat.category.replace(/^K8S-/, '')

        return (
          <div key={cat.category} className="flex shrink-0 flex-col items-center gap-1.5 px-1 py-2">
            <svg viewBox="0 0 60 60" className="h-14 w-14">
              <circle cx={30} cy={30} r={R} fill="none" stroke="#1c2629" strokeWidth={6} />
              <circle
                cx={30}
                cy={30}
                r={R}
                fill="none"
                stroke={fill}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={dash}
                transform="rotate(-90 30 30)"
              />
              <text x={30} y={34} textAnchor="middle" className="font-mono text-[11px] font-bold" fill={fill}>
                {Math.round(cat.avg_pct)}
              </text>
            </svg>
            <span className="text-center text-[9.5px] tracking-wide text-neutral-500">{label}</span>
          </div>
        )
      })}
    </div>
  )
}
