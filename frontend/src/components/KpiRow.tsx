import type { SiteStatus } from '../lib/types'

export function KpiRow({ sites, clusterCount }: { sites: SiteStatus[]; clusterCount?: number }) {
  const withData = sites.filter((s) => s.current_pct !== null)
  const meeting = withData.filter((s) => s.current_pct! >= s.target_pct).length
  const breaching = withData.filter((s) => s.tier === 'crit' || s.tier === 'warn').length

  const tiles = [
    { label: 'Sites monitored', value: String(sites.length), sub: `${withData.length} reporting`, tone: 'text-accent-strong' },
    { label: 'Clusters monitored', value: clusterCount === undefined ? '—' : String(clusterCount), sub: 'reporting into slo table', tone: 'text-warn' },
    { label: 'Meeting target', value: `${meeting} / ${sites.length}`, sub: '≥ target this week', tone: 'text-good' },
    { label: 'Breaching SLO', value: `${breaching} / ${sites.length}`, sub: 'warn + crit tiers', tone: 'text-crit' },
  ]

  return (
    <>
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex h-[104px] min-w-[150px] flex-1 flex-col justify-center rounded-xl border border-line bg-panel p-4 panel-shadow"
        >
          <div className="mb-2 text-[11.5px] font-semibold tracking-wide text-ink-muted uppercase">{tile.label}</div>
          <div className={`font-mono text-[28px] font-semibold tracking-tight tabular-nums ${tile.tone}`}>{tile.value}</div>
          {tile.sub && <div className="mt-1 text-xs text-ink-muted">{tile.sub}</div>}
        </div>
      ))}
    </>
  )
}
