import type { TrendPoint } from '../lib/types'
import { buildAreaPath } from '../lib/chart'

const WIDTH = 1000
const HEIGHT = 60

export function TrendChart({ points, currentOverride }: { points: TrendPoint[]; currentOverride?: number | null }) {
  if (points.length === 0) {
    return <p className="px-4 pb-3 text-xs text-neutral-500">No trend data yet.</p>
  }

  const { line, area, end } = buildAreaPath(
    points.map((p) => p.avg_pct),
    WIDTH,
    HEIGHT,
  )
  // The sparkline's own shape still comes from the trend series (weekly
  // average across every cluster Grafana knows about — useful for shape,
  // not a headline number), but the big overlaid figure defaults to that
  // same series' last point unless the caller has something more specific
  // — e.g. routes/index.tsx passes the average of our *registered* sites'
  // own current_pct (itself already the worst-cluster figure, not an
  // average), so this doesn't read as an inflated global number.
  const latest = currentOverride ?? points[points.length - 1].avg_pct

  return (
    <div className="relative px-4 pb-3">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="block h-[60px] w-full">
        <g stroke="#1a1f26" strokeWidth={1}>
          <line x1={0} y1={HEIGHT * 0.25} x2={WIDTH} y2={HEIGHT * 0.25} />
          <line x1={0} y1={HEIGHT * 0.5} x2={WIDTH} y2={HEIGHT * 0.5} />
          <line x1={0} y1={HEIGHT * 0.75} x2={WIDTH} y2={HEIGHT * 0.75} />
        </g>
        <path d={area} fill="var(--color-accent)" opacity={0.14} />
        <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        <circle cx={end[0]} cy={end[1]} r={3.5} fill="var(--color-accent)" />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-3">
        <span className="font-mono text-[26px] font-bold tabular-nums text-accent-strong drop-shadow-[0_1px_6px_rgba(0,0,0,0.8)]">
          {latest.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}
