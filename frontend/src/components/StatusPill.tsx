import type { Tier } from '../lib/types'
import { TIER_BG_CLASS, TIER_LABEL, TIER_SOFT_BG_CLASS, TIER_TEXT_CLASS } from '../lib/tier'

export function StatusPill({ tier, compact = false }: { tier: Tier; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ${TIER_SOFT_BG_CLASS[tier]} ${TIER_TEXT_CLASS[tier]} ${
        compact ? 'px-1.5 py-0.5 text-[8.5px]' : 'px-2 py-1 text-[11px]'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${TIER_BG_CLASS[tier]}`} />
      {TIER_LABEL[tier]}
    </span>
  )
}
