import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CircleAlert } from 'lucide-react'
import { fetchFindings } from '../lib/api'
import type { Finding } from '../lib/types'

const CATEGORY_LABEL: Record<Finding['category'], string> = {
  no_data: 'No data',
  breach: 'Breaching target',
  category_issue: 'Category issue',
  grafana_mapping: 'Missing Grafana link',
}

function relativeTime(iso: string, nowMillis: number): string {
  const seconds = Math.max(0, Math.round((nowMillis - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  return `${minutes}m ago`
}

export function FindingsList() {
  // The backend's own checker loop only recomputes every 5 minutes (see
  // backend/app/main_admin.py), so this just needs to catch that new
  // result reasonably soon after it lands — no need to poll anywhere near
  // as often as that interval.
  const findingsQuery = useQuery({ queryKey: ['admin-findings'], queryFn: fetchFindings, refetchInterval: 30_000 })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  const lastRun = findingsQuery.data?.last_run
  // "live" here means "the backend has completed at least one scan and
  // we're still within a couple of its 5-minute intervals" — past that,
  // the loop is presumably stuck or the process restarted mid-cycle.
  const isStale = lastRun !== null && lastRun !== undefined && now - new Date(lastRun).getTime() > 11 * 60_000

  const findings = findingsQuery.data?.findings ?? []
  const sorted = [...findings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'crit' ? -1 : 1))

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">
          Todo list{findingsQuery.data && <span className="text-neutral-500"> ({findings.length})</span>}
        </h2>
        {lastRun && (
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
              isStale ? 'border-warn/40 bg-warn/10 text-warn' : 'border-neutral-800 bg-neutral-900 text-neutral-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full motion-safe:animate-pulse ${isStale ? 'bg-warn' : 'bg-good'}`}
            />
            {isStale ? 'stale — checker not responding' : `scanned ${relativeTime(lastRun, now)}`}
          </div>
        )}
      </div>

      {findingsQuery.isPending && <p className="font-mono text-sm text-neutral-500">Loading…</p>}
      {findingsQuery.isError && <p className="font-mono text-sm text-crit">Couldn't reach the admin API.</p>}

      {findingsQuery.data && findings.length === 0 && (
        <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-4 text-center">
          <p className="text-sm text-neutral-500">No issues found on the last scan.</p>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-2 shadow-lg shadow-black/30">
          <div className="grid grid-cols-[16px_1fr_130px_56px_150px] items-center gap-2 px-2 pb-1.5 text-[9.5px] font-semibold tracking-wide text-neutral-500 uppercase">
            <span />
            <span>Issue</span>
            <span>Category</span>
            <span>Site</span>
            <span className="text-right">預估提昇 Site SLO %</span>
          </div>
          <div className="flex flex-col gap-1">
            {sorted.map((f, i) => (
              <div
                key={i}
                className="grid grid-cols-[16px_1fr_130px_56px_150px] items-center gap-2 rounded-lg px-2 py-1.5 odd:bg-neutral-950/40"
              >
                {f.severity === 'crit' ? (
                  <CircleAlert size={13} className="shrink-0 text-crit" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0 text-warn" />
                )}
                <span className="min-w-0 truncate text-[12.5px] text-neutral-200">{f.message}</span>
                <span className="truncate text-[10px] whitespace-nowrap text-neutral-500">{CATEGORY_LABEL[f.category]}</span>
                <span className="truncate font-mono text-[10px] whitespace-nowrap text-accent-strong">{f.site_code ?? '—'}</span>
                <span
                  className={`justify-self-end rounded-full px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap ${
                    f.potential_uplift_pct > 0 ? 'bg-good/15 text-good' : 'bg-neutral-800 text-neutral-500'
                  }`}
                >
                  +{f.potential_uplift_pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
