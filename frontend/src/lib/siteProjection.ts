import { useMemo } from 'react'
import { geoEqualEarth, type GeoProjection } from 'd3-geo'
import type { Feature, Geometry } from 'geojson'
import type { SiteStatus } from './types'

// All ten site cards (right column + bottom row) share this exact height —
// content is fixed-line (code, name, country/clusters, %, sparkline,
// footer), so it doesn't need to vary with card width.
export const CARD_HEIGHT = 146
export const GAP = 14
// The right column always holds this many cards, regardless of window width
// — a fixed, predictable split rather than one that reshuffles as the page
// resizes. Only shrinks below this if there aren't enough sites to fill both
// a right column and a legible bottom row.
const RIGHT_COUNT_TARGET = 3
const MARGIN = 60
const FALLBACK_HEIGHT = 400

function normalizeLon180(lon: number): number {
  return (((lon + 180) % 360) + 360) % 360 - 180
}

/** Finds the widest empty longitude gap between sites (circularly) and returns
 * the rotation that places its midpoint at the projection's seam — so the map
 * cuts through open ocean instead of the shorter-looking-but-actually-longer
 * route through unrelated continents. */
function computeSeamRotation(lons: number[]): number {
  const sorted = [...new Set(lons.map((l) => ((l % 360) + 360) % 360))].sort((a, b) => a - b)
  if (sorted.length < 2) return 0

  let widestGap = -1
  let gapStart = 0
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    const b = i + 1 < sorted.length ? sorted[i + 1] : sorted[0] + 360
    const gap = b - a
    if (gap > widestGap) {
      widestGap = gap
      gapStart = a
    }
  }
  const seamRaw = normalizeLon180(gapStart + widestGap / 2)
  return normalizeLon180(180 - seamRaw)
}

type Plan = {
  projection: GeoProjection
  viewBoxWidth: number
  viewBoxHeight: number
  rightSites: SiteStatus[]
  bottomSites: SiteStatus[]
  cardWidth: number
  cardHeight: number
  gap: number
}

const FALLBACK_PLAN_WIDTH = 960

function fallbackPlan(sites: SiteStatus[]): Plan {
  return {
    projection: geoEqualEarth().fitSize([FALLBACK_PLAN_WIDTH, FALLBACK_HEIGHT], { type: 'Sphere' } as never),
    viewBoxWidth: FALLBACK_PLAN_WIDTH,
    viewBoxHeight: FALLBACK_HEIGHT,
    rightSites: [],
    bottomSites: sites,
    cardWidth: 0,
    cardHeight: CARD_HEIGHT,
    gap: GAP,
  }
}

/**
 * Lays out the map + card grid as one system. The right column always holds
 * `RIGHT_COUNT_TARGET` cards (fewer only if there aren't enough sites to
 * also leave a bottom row) — so the split itself never changes with window
 * width. What DOES adapt to width is every card's shared size: the bottom
 * row's fixed card count divides the available width evenly, and the right
 * column's fixed card count fixes the map's height (so the map never leaves
 * dead space below it). All ten cards render in one CSS Grid so their widths
 * and gaps stay pixel-identical by construction.
 */
export function useSiteLayout(sites: SiteStatus[], stageWidth: number): Plan {
  return useMemo(() => {
    if (sites.length === 0 || stageWidth <= 0) return fallbackPlan(sites)

    const lambda = computeSeamRotation(sites.map((s) => s.longitude))
    const points: Feature<Geometry> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPoint', coordinates: sites.map((s) => [s.longitude, s.latitude]) },
    }

    // Probe: fit into a generous square just to rank each site's
    // right-column suitability (closer to the right column's natural
    // position vs. the bottom row's).
    const PROBE = 1000
    const probe = geoEqualEarth().rotate([lambda, 0])
    probe.fitExtent(
      [
        [MARGIN, MARGIN],
        [PROBE - MARGIN, PROBE - MARGIN],
      ],
      points,
    )
    const probed = sites
      .map((site) => {
        const p = probe([site.longitude, site.latitude])
        return p ? { site, x: p[0], y: p[1] } : null
      })
      .filter((v): v is { site: SiteStatus; x: number; y: number } => v !== null)

    const rightAnchor: [number, number] = [PROBE, PROBE / 2]
    const bottomAnchor: [number, number] = [PROBE / 2, PROBE]
    const ranked = [...probed].sort((a, b) => {
      const prefA = Math.hypot(a.x - bottomAnchor[0], a.y - bottomAnchor[1]) - Math.hypot(a.x - rightAnchor[0], a.y - rightAnchor[1])
      const prefB = Math.hypot(b.x - bottomAnchor[0], b.y - bottomAnchor[1]) - Math.hypot(b.x - rightAnchor[0], b.y - rightAnchor[1])
      return prefB - prefA // higher preference (more right-suited) first
    })

    // Need at least 2 bottom columns for the map to have any width of its
    // own (it spans bottomCount - 1 columns) — fall back to an all-bottom
    // row if there aren't enough sites for that.
    const rightCount = sites.length - RIGHT_COUNT_TARGET >= 2 ? RIGHT_COUNT_TARGET : 0
    const bottomCount = sites.length - rightCount

    if (rightCount === 0) {
      const cardWidth = (stageWidth - (bottomCount - 1) * GAP) / bottomCount
      return {
        projection: geoEqualEarth().rotate([lambda, 0]).fitExtent(
          [
            [MARGIN, MARGIN],
            [stageWidth - MARGIN, FALLBACK_HEIGHT - MARGIN],
          ],
          points,
        ),
        viewBoxWidth: stageWidth,
        viewBoxHeight: FALLBACK_HEIGHT,
        rightSites: [],
        bottomSites: sites,
        cardWidth,
        cardHeight: CARD_HEIGHT,
        gap: GAP,
      }
    }

    const cardWidth = (stageWidth - (bottomCount - 1) * GAP) / bottomCount
    const mapWidth = stageWidth - GAP - cardWidth
    const mapHeight = rightCount * CARD_HEIGHT + (rightCount - 1) * GAP

    const rightCodes = new Set(ranked.slice(0, rightCount).map((r) => r.site.code))
    const rightSites = ranked
      .filter((r) => rightCodes.has(r.site.code))
      .sort((a, b) => a.y - b.y)
      .map((r) => r.site)
    const bottomSites = ranked
      .filter((r) => !rightCodes.has(r.site.code))
      .sort((a, b) => a.x - b.x)
      .map((r) => r.site)

    const projection = geoEqualEarth()
      .rotate([lambda, 0])
      .fitExtent(
        [
          [MARGIN, MARGIN],
          [mapWidth - MARGIN, mapHeight - MARGIN],
        ],
        points,
      )

    return {
      projection,
      viewBoxWidth: mapWidth,
      viewBoxHeight: mapHeight,
      rightSites,
      bottomSites,
      cardWidth,
      cardHeight: CARD_HEIGHT,
      gap: GAP,
    }
  }, [sites, stageWidth])
}
