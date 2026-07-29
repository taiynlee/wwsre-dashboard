export const OCEAN_NAME_ZH: Record<string, string> = {
  'Pacific Ocean': '太平洋',
  'Atlantic Ocean': '大西洋',
  'Indian Ocean': '印度洋',
  'Arctic Ocean': '北冰洋',
  'Southern Ocean': '南冰洋',
}

/**
 * Coarse lon/lat -> ocean lookup used for the map's water hover tooltip.
 * There's no real ocean geometry to hit-test against (unlike countries, which
 * use actual topojson polygons), so this just buckets by latitude band and,
 * within the temperate/tropical band, by the traditional longitude
 * boundaries between oceans (roughly the Americas' coasts and the Cape of
 * Good Hope). Good enough for a hover label; not geographically authoritative
 * right at the boundaries.
 */
export function classifyOcean(lon: number, lat: number): string {
  const normalizedLon = ((((lon + 180) % 360) + 360) % 360) - 180
  if (lat >= 66.5) return 'Arctic Ocean'
  if (lat <= -60) return 'Southern Ocean'
  if (normalizedLon >= -70 && normalizedLon < 20) return 'Atlantic Ocean'
  if (normalizedLon >= 20 && normalizedLon < 100) return 'Indian Ocean'
  return 'Pacific Ocean'
}
