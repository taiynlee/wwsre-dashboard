import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import type { SiteStatus } from '../lib/types'
import { StatusPill } from './StatusPill'
import { Sparkline } from './Sparkline'

/** No real timezone database here — just longitude — so this is the
 * standard 15°-per-hour approximation, not an authoritative admin timezone. */
function approxUtcOffset(longitude: number): number {
  return Math.round(longitude / 15)
}

/** `Date#getTime()` is already a timezone-agnostic UTC epoch, so shifting it
 * by the offset and reading back with the UTC getters gives the wall-clock
 * date/time at that offset regardless of the browser's own local timezone. */
function formatLocalDateTime(nowMillis: number, offset: number): string {
  const shifted = new Date(nowMillis + offset * 3_600_000)
  const hh = String(shifted.getUTCHours()).padStart(2, '0')
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0')
  return `${shifted.getUTCFullYear()}/${shifted.getUTCMonth() + 1}/${shifted.getUTCDate()} ${hh}:${mm}`
}

export function SiteMiniCard({ site, selected, onSelect }: { site: SiteStatus; selected: boolean; onSelect: () => void }) {
  const valueText = site.current_pct === null ? '—' : `${site.current_pct.toFixed(1)}%`

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className={`flex min-h-0 cursor-pointer flex-col justify-between gap-1 rounded-lg border bg-canvas/40 p-2 transition ${
        selected ? 'border-accent' : 'border-line hover:border-line-strong'
      } ${site.tier === 'unknown' ? 'opacity-70' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="truncate font-mono text-[13px] font-bold tracking-wide text-accent-strong">{site.code}</div>
          <div className="truncate text-[12px] leading-tight font-semibold">{site.display_name}</div>
        </div>
        <StatusPill tier={site.tier} compact />
      </div>

      <div className="truncate text-[9.5px] leading-tight text-ink-soft">
        {site.country} · <span className="text-warn font-semibold">{site.cluster_count}</span> cluster{site.cluster_count === 1 ? '' : 's'}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[16px] font-bold tracking-tight tabular-nums">{valueText}</span>
        <span className="font-mono text-[8.5px] text-ink-muted">target {site.target_pct.toFixed(1)}%</span>
      </div>

      <Sparkline series={site.history} tier={site.tier} height={18} />

      <div className="flex items-baseline justify-between border-t border-dashed border-line pt-1">
        <span className="font-mono text-[7.5px] whitespace-nowrap text-ink-muted">
          local time {formatLocalDateTime(now, approxUtcOffset(site.longitude))}
        </span>
        <Link
          to="/sites/$code"
          params={{ code: site.code }}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-accent-strong hover:underline"
        >
          Detail <ExternalLink size={9} />
        </Link>
      </div>
    </div>
  )
}
