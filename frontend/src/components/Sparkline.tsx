import type { Tier } from '../lib/types'
import { buildAreaPath } from '../lib/chart'
import { TIER_FILL } from '../lib/tier'

export function Sparkline({ series, tier, width = 210, height = 34 }: { series: number[]; tier: Tier; width?: number; height?: number }) {
  if (series.length === 0) {
    return (
      <div className="flex items-center text-[11.5px] text-ink-muted" style={{ height }}>
        no history this window
      </div>
    )
  }

  const { line, area, end } = buildAreaPath(series, width, height)
  const fill = TIER_FILL[tier]

  return (
    <svg className="block w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ height }} aria-hidden="true">
      <path d={area} fill={fill} opacity={0.16} />
      <path d={line} fill="none" stroke={fill} strokeWidth={1.6} />
      <circle cx={end[0]} cy={end[1]} r={2.4} fill={fill} />
    </svg>
  )
}
