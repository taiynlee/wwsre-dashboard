import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { fetchClusterLive, fetchSiteCategories, fetchSiteClusters, fetchSites } from '../lib/api'
import { AppShell } from '../components/AppShell'
import { StatusPill } from '../components/StatusPill'
import { Sparkline } from '../components/Sparkline'
import { CategoryRings } from '../components/CategoryRings'

export const Route = createFileRoute('/sites/$code')({
  component: SiteDetail,
})

function SiteDetail() {
  const { code } = Route.useParams()

  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites })
  const clustersQuery = useQuery({ queryKey: ['site-clusters', code], queryFn: () => fetchSiteClusters(code) })
  const categoriesQuery = useQuery({ queryKey: ['site-categories', code], queryFn: () => fetchSiteCategories(code) })

  const site = sitesQuery.data?.sites.find((s) => s.code === code)

  return (
    <AppShell>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-neutral-200">
        <ArrowLeft size={14} /> Back to overview
      </Link>

      {sitesQuery.isPending && <p className="font-mono text-sm text-neutral-500">Loading…</p>}

      {site && (
        <>
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-900 pb-5">
            <div>
              <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.14em] text-accent-strong uppercase">{site.code}</p>
              <h1 className="text-[28px] font-semibold tracking-tight">
                {site.display_name} <span className="text-neutral-500">· {site.country}</span>
              </h1>
            </div>
            <StatusPill tier={site.tier} />
          </header>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat label="Current SLO" value={site.current_pct === null ? '—' : `${site.current_pct.toFixed(1)}%`} />
            <Stat label="Target" value={`${site.target_pct.toFixed(1)}%`} />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-lg shadow-black/30">
              <div className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">History</div>
              <Sparkline series={site.history} tier={site.tier} height={44} />
            </div>
          </div>

          <h2 className="mb-3 text-[15px] font-semibold">Category breakdown</h2>
          {categoriesQuery.isPending && <p className="font-mono text-sm text-neutral-500">Loading categories…</p>}
          {categoriesQuery.isError && <p className="font-mono text-sm text-crit">Couldn't load category breakdown.</p>}
          {categoriesQuery.data && (
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg shadow-black/30">
              <CategoryRings categories={categoriesQuery.data} />
            </div>
          )}

          <h2 className="mb-3 text-[15px] font-semibold">Clusters</h2>
          {clustersQuery.isPending && <p className="font-mono text-sm text-neutral-500">Loading clusters…</p>}
          {clustersQuery.isError && <p className="font-mono text-sm text-crit">Couldn't load cluster detail.</p>}
          {clustersQuery.data?.length === 0 && <p className="font-mono text-sm text-neutral-500">No clusters reporting for this site yet.</p>}
          {clustersQuery.data && clustersQuery.data.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg shadow-black/30">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-[11px] tracking-wide text-neutral-500 uppercase">
                    <th className="px-4 py-3 font-semibold">Cluster ID</th>
                    <th className="px-4 py-3 font-semibold">Current SLO</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Live detail</th>
                  </tr>
                </thead>
                <tbody>
                  {clustersQuery.data.map((cluster) => (
                    <ClusterRow key={cluster.cluster_id} clusterId={cluster.cluster_id} currentPct={cluster.current_pct} tier={cluster.tier} />
                  ))}
                </tbody>
              </table>
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-lg shadow-black/30">
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</div>
      <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}

function ClusterRow({ clusterId, currentPct, tier }: { clusterId: string; currentPct: number | null; tier: 'good' | 'warn' | 'crit' | 'unknown' }) {
  const liveQuery = useQuery({ queryKey: ['cluster-live', clusterId], queryFn: () => fetchClusterLive(clusterId) })

  return (
    <tr className="border-b border-neutral-900 last:border-0">
      <td className="px-4 py-3 font-mono text-[13px]">{clusterId}</td>
      <td className="px-4 py-3 font-mono tabular-nums">{currentPct === null ? '—' : `${currentPct.toFixed(1)}%`}</td>
      <td className="px-4 py-3">
        <StatusPill tier={tier} />
      </td>
      <td className="px-4 py-3">
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
          <span className="text-[11px] text-neutral-600">no link on record</span>
        )}
      </td>
    </tr>
  )
}
