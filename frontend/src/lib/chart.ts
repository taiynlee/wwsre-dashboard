export interface AreaPath {
  line: string
  area: string
  end: readonly [number, number]
}

/** Builds an SVG line+area path for a 0-100-scaled series, floored so a mostly-flat
 * high series (e.g. 99.x%) doesn't render as a dead straight line at the top. */
export function buildAreaPath(series: number[], width: number, height: number): AreaPath {
  const positive = series.filter((v) => v > 0)
  const floor = Math.min(40, positive.length ? Math.min(...positive) : 40)
  const min = floor
  const max = 100
  const n = series.length

  const points = series.map((v, i) => {
    const x = n > 1 ? (i / (n - 1)) * width : width
    const clamped = Math.max(v, min)
    const y = height - ((clamped - min) / (max - min)) * height
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`

  return { line, area, end: points[points.length - 1] }
}
