import { Link } from '@tanstack/react-router'
import { ExternalLink } from 'lucide-react'
import type { SiteStatus } from '../lib/types'
import { StatusPill } from './StatusPill'
import { Sparkline } from './Sparkline'

export function SiteMiniCard({ site, selected, onSelect }: { site: SiteStatus; selected: boolean; onSelect: () => void }) {
  const valueText = site.current_pct === null ? '—' : `${site.current_pct.toFixed(1)}%`

  return (
    <div
      className={`flex min-h-0 cursor-pointer flex-col justify-between gap-1 rounded-lg border bg-neutral-950/40 p-2 transition ${
        selected ? 'border-accent' : 'border-neutral-800 hover:border-neutral-700'
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

      <div className="truncate text-[9.5px] leading-tight text-neutral-400">
        {site.country} · {site.cluster_count} cluster{site.cluster_count === 1 ? '' : 's'}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[16px] font-bold tracking-tight tabular-nums">{valueText}</span>
        <span className="font-mono text-[8.5px] text-neutral-500">target {site.target_pct.toFixed(1)}%</span>
      </div>

      <Sparkline series={site.history} tier={site.tier} height={18} />

      <div className="flex items-center justify-between border-t border-dashed border-neutral-800 pt-1">
        <span className="font-mono text-[8.5px] text-neutral-500">{site.history.length > 0 ? 'history window' : 'awaiting report'}</span>
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
