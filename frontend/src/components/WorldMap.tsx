import { useEffect, useMemo, useRef, useState } from 'react'
import { geoPath, type GeoProjection } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { SiteStatus } from '../lib/types'
import { TIER_FILL, TIER_LABEL } from '../lib/tier'
import { CONTINENT_FILL, CONTINENT_FILL_HOVER, COUNTRY_CONTINENT } from '../lib/continents'
import { COUNTRY_NAME_ZH } from '../lib/countryNamesZh'
import { OCEAN_NAME_ZH, classifyOcean } from '../lib/oceans'

type CountryFeature = Feature<Geometry, { name: string }>

export function WorldMap({
  sites,
  selected,
  onSelect,
  onPinRef,
  onDotRef,
  projection,
  viewBoxWidth,
  viewBoxHeight,
}: {
  sites: SiteStatus[]
  selected: string | null
  onSelect: (code: string) => void
  onPinRef?: (code: string, el: SVGGElement | null) => void
  /** Ref to just the visible dot circle (not the whole pin group, which also
   * includes the label pill) — the label's position varies per site, so
   * anchoring a connector line off the full group's bounding box would drift
   * away from the dot whenever the label sits below/beside it. */
  onDotRef?: (code: string, el: SVGCircleElement | null) => void
  projection: GeoProjection
  viewBoxWidth: number
  viewBoxHeight: number
}) {
  const [countries, setCountries] = useState<FeatureCollection<Geometry, { name: string }> | null>(null)
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // The page-wide ScaleToFit wrapper applies a CSS transform above this
  // component, which changes what `position: fixed` descendants anchor to
  // (per spec, a transformed ancestor becomes their containing block instead
  // of the viewport) — so raw e.clientX/clientY no longer lines up. Position
  // the tooltip relative to this container instead, converting screen pixels
  // to the container's own (unscaled) coordinate space via the ratio between
  // its rendered size and its layout size — that ratio equals the current
  // scale factor regardless of where it came from.
  const setHoverFromEvent = (name: string, e: { clientX: number; clientY: number }) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const scale = rect.width / el.offsetWidth || 1
    setHover({ name, x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale })
  }

  // There's no ocean geometry to hit-test the way country <path>s are, so
  // hovering water instead maps the cursor back to lon/lat (via the SVG's
  // own viewBox <-> rendered-box transform, since preserveAspectRatio may
  // letterbox it independently of ScaleToFit's own scaling) and buckets
  // that into a coarse ocean name.
  const handleOceanHover = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg || !projection.invert) return
    const svgRect = svg.getBoundingClientRect()
    const svgAspect = svgRect.width / svgRect.height
    const viewBoxAspect = viewBoxWidth / viewBoxHeight
    let scale: number
    let offsetX = 0
    let offsetY = 0
    if (svgAspect > viewBoxAspect) {
      scale = svgRect.height / viewBoxHeight
      offsetX = (svgRect.width - viewBoxWidth * scale) / 2
    } else {
      scale = svgRect.width / viewBoxWidth
      offsetY = (svgRect.height - viewBoxHeight * scale) / 2
    }
    const viewBoxX = (e.clientX - svgRect.left - offsetX) / scale
    const viewBoxY = (e.clientY - svgRect.top - offsetY) / scale
    const geo = projection.invert([viewBoxX, viewBoxY])
    if (!geo) return
    setHoverFromEvent(classifyOcean(geo[0], geo[1]), e)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/countries-110m.json')
      .then((r) => r.json() as Promise<Topology>)
      .then((topology) => {
        if (cancelled) return
        const countryObject = topology.objects.countries as GeometryCollection
        setCountries(
          feature(topology, countryObject) as unknown as FeatureCollection<Geometry, { name: string }>,
        )
      })
      .catch(() => {
        // map background is decorative — pins still render fine without it
      })
    return () => {
      cancelled = true
    }
  }, [])

  const path = useMemo(() => geoPath(projection), [projection])

  // Pick a label side (right/left/top/bottom) per pin that keeps it clear of
  // neighboring pins AND other labels — sites cluster tightly in places (e.g.
  // Chengdu/Chongqing, Vietnam/Zhongshan), so this claims rectangles greedily:
  // every dot is pre-claimed as a small exclusion zone, then each label picks
  // the first side whose bounding box doesn't overlap anything claimed so far.
  const placed = useMemo(() => {
    type Rect = { x: number; y: number; w: number; h: number }
    const rectsOverlap = (a: Rect, b: Rect) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

    const positioned = sites
      .map((site) => {
        const p = projection([site.longitude, site.latitude])
        return p ? { site, x: p[0], y: p[1] } : null
      })
      .filter((v): v is { site: SiteStatus; x: number; y: number } => v !== null)

    const DOT_PAD = 10
    const charW = 7.3
    const claimed: Rect[] = positioned.map((p) => ({
      x: p.x - DOT_PAD,
      y: p.y - DOT_PAD,
      w: DOT_PAD * 2,
      h: DOT_PAD * 2,
    }))

    return positioned.map(({ site, x, y }) => {
      const textW = site.code.length * charW
      const candidates: Array<{ side: 'right' | 'left' | 'top' | 'bottom'; dx: number; dy: number; rect: Rect }> = [
        { side: 'right', dx: 14, dy: 4.5, rect: { x: x + 10, y: y - 7, w: textW + 8, h: 16 } },
        { side: 'left', dx: -14, dy: 4.5, rect: { x: x - 18 - textW, y: y - 7, w: textW + 8, h: 16 } },
        { side: 'top', dx: 0, dy: -14, rect: { x: x - textW / 2 - 4, y: y - 25, w: textW + 8, h: 16 } },
        { side: 'bottom', dx: 0, dy: 21, rect: { x: x - textW / 2 - 4, y: y + 10, w: textW + 8, h: 16 } },
      ]

      const chosen = candidates.find((c) => !claimed.some((r) => rectsOverlap(c.rect, r))) ?? candidates[0]
      claimed.push(chosen.rect)
      return { site, x, y, dx: chosen.dx, dy: chosen.dy, side: chosen.side }
    })
  }, [sites, projection])

  return (
    <div ref={containerRef} className="relative h-full">
      {/* Not role="img" on the svg — that would flatten the interactive pins
          out of the accessibility tree. This is a labeled group of real controls. */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        role="group"
        aria-label="World map with SLO status pins for tracked sites"
      >
        <defs>
          <filter id="pin-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Sits beneath the country paths, so land clicks/hovers still hit
            those first — only mouse positions not covered by any country
            polygon (i.e. water) fall through to this and get bucketed into
            an ocean name. pointerEvents="all" makes it hit-testable despite
            the transparent fill (SVG's default visiblePainted hit-testing
            would otherwise skip a fully transparent shape). */}
        <rect
          x={0}
          y={0}
          width={viewBoxWidth}
          height={viewBoxHeight}
          fill="transparent"
          pointerEvents="all"
          onMouseMove={handleOceanHover}
          onMouseLeave={() => setHover(null)}
        />

        {countries && (
          <g aria-hidden="true">
            {countries.features.map((f: CountryFeature) => {
              const continent = COUNTRY_CONTINENT[f.properties.name] ?? 'other'
              const isHovered = hover?.name === f.properties.name
              return (
                <path
                  key={f.id ?? f.properties.name}
                  d={path(f) ?? undefined}
                  className="transition-colors duration-100"
                  fill={isHovered ? CONTINENT_FILL_HOVER[continent] : CONTINENT_FILL[continent]}
                  stroke="#4a5a66"
                  strokeWidth={0.6}
                  onMouseMove={(e) => setHoverFromEvent(f.properties.name, e)}
                  onMouseLeave={() => setHover(null)}
                />
              )
            })}
          </g>
        )}

        <g>
          {placed.map(({ site, x, y, dx, dy, side }) => {
            const fill = TIER_FILL[site.tier]
            const isSelected = selected === site.code
            const pulsing = site.tier === 'warn' || site.tier === 'crit' || site.tier === 'unknown'
            const valueText = site.current_pct === null ? 'no data' : `${site.current_pct.toFixed(1)}%`

            const charW = 7.3
            const textW = site.code.length * charW
            const anchor = side === 'left' ? 'end' : side === 'right' ? 'start' : 'middle'
            const pillX = side === 'left' ? dx - textW - 4 : side === 'right' ? dx - 4 : dx - textW / 2 - 4
            const pillY = dy - 11

            return (
              <g
                key={site.code}
                ref={(el) => onPinRef?.(site.code, el)}
                transform={`translate(${x},${y})`}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`${site.display_name} (${site.code}) — ${TIER_LABEL[site.tier]}, ${valueText}`}
                aria-pressed={isSelected}
                onClick={() => onSelect(site.code)}
                onMouseEnter={() => setHover(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelect(site.code)
                  }
                }}
              >
                {pulsing && <circle r={12} fill="none" stroke={fill} strokeWidth={2.5} className="motion-safe:animate-ping" opacity={0.5} />}
                <circle
                  ref={(el) => onDotRef?.(site.code, el)}
                  r={7}
                  fill={fill}
                  stroke={isSelected ? 'var(--color-accent)' : '#0a0c0f'}
                  strokeWidth={isSelected ? 2.8 : 1.8}
                  filter="url(#pin-glow)"
                />
                <rect x={pillX} y={pillY} width={textW + 8} height={16} rx={4} fill="rgba(10,12,15,0.72)" />
                <text x={dx} y={dy} textAnchor={anchor} className="font-mono text-[12px] font-semibold" fill={isSelected ? '#eaedf1' : '#c3ccce'}>
                  {site.code}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-200 shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.name}
          {(COUNTRY_NAME_ZH[hover.name] ?? OCEAN_NAME_ZH[hover.name]) && (
            <span className="text-neutral-400"> {COUNTRY_NAME_ZH[hover.name] ?? OCEAN_NAME_ZH[hover.name]}</span>
          )}
        </div>
      )}
    </div>
  )
}
