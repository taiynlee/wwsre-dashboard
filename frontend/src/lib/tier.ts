import type { Tier } from './types'

export const TIER_LABEL: Record<Tier, string> = {
  good: 'Normal',
  warn: 'Abnormal · no impact',
  crit: 'Abnormal · impact',
  unknown: 'No data',
}

export const TIER_TEXT_CLASS: Record<Tier, string> = {
  good: 'text-good',
  warn: 'text-warn',
  crit: 'text-crit',
  unknown: 'text-unknown',
}

export const TIER_BG_CLASS: Record<Tier, string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  crit: 'bg-crit',
  unknown: 'bg-unknown',
}

export const TIER_SOFT_BG_CLASS: Record<Tier, string> = {
  good: 'bg-good/15',
  warn: 'bg-warn/15',
  crit: 'bg-crit/15',
  unknown: 'bg-unknown/15',
}

// SVG `fill`/`stroke` attributes can reference the same CSS custom properties
// Tailwind's @theme block generates, so colors stay defined in one place (index.css).
export const TIER_FILL: Record<Tier, string> = {
  good: 'var(--color-good)',
  warn: 'var(--color-warn)',
  crit: 'var(--color-crit)',
  unknown: 'var(--color-unknown)',
}
