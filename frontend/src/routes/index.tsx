import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchClusterCount, fetchSites, fetchTrend } from '../lib/api'
import { AppShell } from '../components/AppShell'
import { KpiRow } from '../components/KpiRow'
import { WorldMap } from '../components/WorldMap'
import { TrendChart } from '../components/TrendChart'
import { SiteMiniCard } from '../components/SiteMiniCard'
import { ConnectorLine } from '../components/ConnectorLine'
import { useSiteLayout } from '../lib/siteProjection'

export const Route = createFileRoute('/')({
  component: Overview,
})

function Overview() {
  const [selected, setSelected] = useState<string | null>(null)
  const pinRefs = useRef<Record<string, SVGGElement | null>>({})
  const dotRefs = useRef<Record<string, SVGCircleElement | null>>({})
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const stageRef = useRef<HTMLDivElement | null>(null)
  const stageResizeObserverRef = useRef<ResizeObserver | null>(null)

  const sitesQuery = useQuery({ queryKey: ['sites'], queryFn: fetchSites })
  const trendQuery = useQuery({ queryKey: ['trend'], queryFn: fetchTrend })
  const clusterCountQuery = useQuery({ queryKey: ['cluster-count'], queryFn: fetchClusterCount })

  const sites = sitesQuery.data?.sites ?? []

  // The card grid's column count (and therefore every card's shared width)
  // is derived from the stage's real rendered width, so it's measured live
  // rather than assumed. A callback ref (not a mount-time effect) is what
  // makes this reliable: the stage div doesn't exist yet on first render
  // (an EmptyState/loading state renders in its place until sites load), so
  // an effect with an empty dep array would capture a null node and never
  // retry once the real div mounts later.
  const [stageWidth, setStageWidth] = useState(0)
  const setStageNode = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el
    stageResizeObserverRef.current?.disconnect()
    stageResizeObserverRef.current = null
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setStageWidth(w)
    })
    ro.observe(el)
    stageResizeObserverRef.current = ro
  }, [])

  const { projection, viewBoxWidth, viewBoxHeight, rightSites, bottomSites, cardHeight, gap } = useSiteLayout(sites, stageWidth)

  // Clicking anywhere that isn't ANY registered pin or card clears the
  // selection (and with it, the connector line) — map background, page
  // whitespace, header, all count as "outside". Checking every registered
  // ref (not just the currently-selected one) matters because this
  // document-level listener fires after a newly-clicked pin/card's own
  // onClick already changed `selected` — if we only checked the old
  // selection here, a direct switch between two sites would immediately
  // undo the new selection.
  useEffect(() => {
    if (!selected) return
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node
      const insidePin = Object.values(pinRefs.current).some((el) => el?.contains(target))
      const insideCard = Object.values(cardRefs.current).some((el) => el?.contains(target))
      if (insidePin || insideCard) return
      setSelected(null)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [selected])

  if (sitesQuery.isPending) {
    return (
      <AppShell>
        <p className="font-mono text-sm text-neutral-500">Loading site status…</p>
      </AppShell>
    )
  }

  if (sitesQuery.isError) {
    return (
      <AppShell>
        <p className="font-mono text-sm text-crit">Couldn't reach the backend API. Is it running on VITE_PUBLIC_API_BASE_URL?</p>
      </AppShell>
    )
  }

  const { stale } = sitesQuery.data

  return (
    <AppShell>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-5 border-b border-neutral-900 pb-5">
        <div className="flex items-center gap-3">
          {/* logo.* is gitignored (confidential) — drop the real file into frontend/public/, hidden if absent */}
          <img
            src="/logo.png"
            alt=""
            className="h-[28px] w-auto"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
          <h1 className="text-[28px] font-semibold tracking-tight text-balance">World Wide SRE · K8S Service Level Dashboard</h1>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-2 font-mono text-xs ${
            stale ? 'border-warn/40 bg-warn/10 text-warn' : 'border-neutral-800 bg-neutral-900 text-neutral-400'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full motion-safe:animate-pulse ${
              stale ? 'bg-warn shadow-[0_0_0_3px_rgba(232,163,61,0.14)]' : 'bg-good shadow-[0_0_0_3px_rgba(63,191,127,0.14)]'
            }`}
          />
          {stale ? 'stale — Grafana unreachable' : sitesQuery.isFetching ? 'syncing…' : 'live'}
        </div>
      </header>

      {sites.length === 0 ? (
        <EmptyState message="No sites configured yet. Add one from the admin panel." />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_380px]">
            <div className="flex flex-wrap gap-3.5">
              <KpiRow sites={sites} clusterCount={clusterCountQuery.data} />
            </div>
            <div className="h-[104px] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg shadow-black/30">
              <div className="flex items-center justify-between gap-2.5 px-[18px] pt-3 pb-1">
                <h2 className="text-[13.5px] font-semibold whitespace-nowrap">Global SLO trend</h2>
                <span className="font-mono text-[11px] whitespace-nowrap text-neutral-500">weekly avg, all sites</span>
              </div>
              {trendQuery.isPending && <LoadingRow />}
              {trendQuery.isError && <ErrorRow message="Couldn't load trend data." />}
              {trendQuery.data && <TrendChart points={trendQuery.data} />}
            </div>
          </div>

          <div ref={setStageNode} className="relative">
            {bottomSites.length > 0 && (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${bottomSites.length}, 1fr)`,
                  gridTemplateRows:
                    rightSites.length > 0 ? `repeat(${rightSites.length}, ${cardHeight}px) ${cardHeight}px` : `auto ${cardHeight}px`,
                  gap: `${gap}px`,
                }}
              >
                <div
                  className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-lg shadow-black/30"
                  style={{
                    gridColumn: rightSites.length > 0 ? `1 / span ${bottomSites.length - 1}` : '1 / -1',
                    gridRow: rightSites.length > 0 ? `1 / span ${rightSites.length}` : '1',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5 px-[18px] pt-4 pb-1">
                    <h2 className="text-[13.5px] font-semibold">Site status — this week</h2>
                    <div className="flex flex-wrap gap-3.5 text-[11.5px] text-neutral-400">
                      <Legend color="bg-good" label="Normal" />
                      <Legend color="bg-warn" label="No impact" />
                      <Legend color="bg-crit" label="Impact" />
                      <Legend color="bg-unknown" label="No data" />
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 px-4 pt-2 pb-3">
                    <WorldMap
                      sites={sites}
                      selected={selected}
                      onSelect={setSelected}
                      onPinRef={(code, el) => {
                        pinRefs.current[code] = el
                      }}
                      onDotRef={(code, el) => {
                        dotRefs.current[code] = el
                      }}
                      projection={projection}
                      viewBoxWidth={viewBoxWidth}
                      viewBoxHeight={viewBoxHeight}
                    />
                  </div>
                </div>

                {rightSites.map((site, i) => (
                  <div
                    key={site.code}
                    ref={(el) => {
                      cardRefs.current[site.code] = el
                    }}
                    className="min-h-0 min-w-0 overflow-hidden"
                    style={{ gridColumn: bottomSites.length, gridRow: i + 1 }}
                  >
                    <SiteMiniCard
                      site={site}
                      selected={selected === site.code}
                      onSelect={() => setSelected((c) => (c === site.code ? null : site.code))}
                    />
                  </div>
                ))}

                {bottomSites.map((site, i) => (
                  <div
                    key={site.code}
                    ref={(el) => {
                      cardRefs.current[site.code] = el
                    }}
                    className="min-h-0 min-w-0 overflow-hidden"
                    style={{ gridColumn: i + 1, gridRow: rightSites.length > 0 ? rightSites.length + 1 : 2 }}
                  >
                    <SiteMiniCard
                      site={site}
                      selected={selected === site.code}
                      onSelect={() => setSelected((c) => (c === site.code ? null : site.code))}
                    />
                  </div>
                ))}
              </div>
            )}

            <ConnectorLine
              containerRef={stageRef}
              fromEl={selected ? dotRefs.current[selected] : null}
              toEl={selected ? cardRefs.current[selected] : null}
              toSide={selected && rightSites.some((s) => s.code === selected) ? 'left' : 'top'}
            />
          </div>
        </>
      )}
    </AppShell>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  )
}

function LoadingRow() {
  return <p className="px-[18px] pb-4 font-mono text-xs text-neutral-500">Loading…</p>
}

function ErrorRow({ message }: { message: string }) {
  return <p className="px-[18px] pb-4 font-mono text-xs text-crit">{message}</p>
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/50 p-8 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  )
}
