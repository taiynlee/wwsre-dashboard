import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { fetchClusterCategories, fetchClusterLive, fetchSiteClusters, fetchSites } from '../lib/api'
import { AppShell } from '../components/AppShell'
import { StatusPill } from '../components/StatusPill'
import { Sparkline } from '../components/Sparkline'
import { TIER_FILL } from '../lib/tier'

const RING_R = 17
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R

export const Route = createFileRoute('/sites/$code')({
  component: SiteDetail,
})

function SiteDetail() {
  const { code } = Route.useParams()

  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites })
  const clustersQuery = useQuery({ queryKey: ['site-clusters', code], queryFn: () => fetchSiteClusters(code) })

  const site = sitesQuery.data?.sites.find((s) => s.code === code)

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft size={14} /> Back to overview
      </Link>

      {sitesQuery.isPending && <p className="font-mono text-sm text-ink-muted">Loading…</p>}

      {site && (
        <>
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line-faint pb-5">
            <div>
              <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-accent-strong uppercase">{site.code}</p>
              <h1 className="text-[28px] font-semibold tracking-tight">
                {site.display_name} <span className="text-ink-muted">· {site.country}</span>
              </h1>
            </div>
            <StatusPill tier={site.tier} />
          </header>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Current SLO" value={site.current_pct === null ? '—' : `${site.current_pct.toFixed(1)}%`} />
            <Stat label="Target" value={`${site.target_pct.toFixed(1)}%`} />
            <div className="rounded-xl border border-line bg-panel p-4 panel-shadow">
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">History</div>
              <Sparkline series={site.history} tier={site.tier} height={44} />
            </div>
          </div>

          <h2 className="mb-3 text-[15px] font-semibold">Clusters</h2>
          {clustersQuery.isPending && <p className="font-mono text-sm text-ink-muted">Loading clusters…</p>}
          {clustersQuery.isError && <p className="font-mono text-sm text-crit">Couldn't load cluster detail.</p>}
          {clustersQuery.data?.length === 0 && <p className="font-mono text-sm text-ink-muted">No clusters reporting for this site yet.</p>}
          {clustersQuery.data && clustersQuery.data.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {clustersQuery.data.map((cluster) => (
                <ClusterCard key={cluster.cluster_id} clusterId={cluster.cluster_id} currentPct={cluster.current_pct} tier={cluster.tier} />
              ))}
            </div>
          )}
        </>
      )}

      {!sitesQuery.isPending && !site && <p className="font-mono text-sm text-crit">Unknown site code: {code}</p>}
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel p-4 panel-shadow">
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ClusterCard({ clusterId, currentPct, tier }: { clusterId: string; currentPct: number | null; tier: 'good' | 'warn' | 'crit' | 'unknown' }) {
  const liveQuery = useQuery({ queryKey: ['cluster-live', clusterId], queryFn: () => fetchClusterLive(clusterId) })
  const categoriesQuery = useQuery({ queryKey: ['cluster-categories', clusterId], queryFn: () => fetchClusterCategories(clusterId) })

  return (
    <div className="group relative flex flex-col gap-2.5 rounded-xl border border-line bg-panel p-4 panel-shadow">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-mono text-[13px] font-semibold">{clusterId}</span>
        <StatusPill tier={tier} compact />
      </div>
      <div className="font-mono text-xl font-semibold tabular-nums">{currentPct === null ? '—' : `${currentPct.toFixed(1)}%`}</div>
      <div>
        {liveQuery.data?.available ? (
          <span className="font-mono text-[11px] text-good">live metrics available</span>
        ) : liveQuery.data?.external_url ? (
          <a
            href={liveQuery.data.external_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent-strong hover:underline"
          >
            Open in Grafana <ExternalLink size={12} />
          </a>
        ) : (
          <span className="text-[11px] text-ink-faint">no link on record</span>
        )}
      </div>

      {categoriesQuery.data && categoriesQuery.data.length > 0 && (
        <div className="dropdown-shadow pointer-events-none absolute top-full left-0 z-20 mt-1.5 w-max min-w-full rounded-lg border border-line-strong bg-panel p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="mb-1.5 text-[9px] font-semibold tracking-wide text-ink-muted uppercase">This cluster, by category</div>
          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {categoriesQuery.data.map((cat) => {
              const fraction = Math.max(0, Math.min(1, cat.avg_pct / 100))
              const dash = `${(fraction * RING_CIRCUMFERENCE).toFixed(1)} ${RING_CIRCUMFERENCE.toFixed(1)}`
              const fill = TIER_FILL[cat.tier]
              return (
                <div key={cat.category} className="flex flex-col items-center gap-1">
                  <svg viewBox="0 0 40 40" className="h-11 w-11">
                    <circle cx={20} cy={20} r={RING_R} fill="none" stroke="var(--color-line)" strokeWidth={4} />
                    <circle
                      cx={20}
                      cy={20}
                      r={RING_R}
                      fill="none"
                      stroke={fill}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={dash}
                      transform="rotate(-90 20 20)"
                    />
                    <text x={20} y={23} textAnchor="middle" className="font-mono text-[8.5px] font-bold" fill={fill}>
                      {cat.avg_pct.toFixed(1)}
                    </text>
                  </svg>
                  <span className="text-center text-[8px] whitespace-nowrap text-ink-muted">{cat.category.replace(/^K8S-/, '')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
