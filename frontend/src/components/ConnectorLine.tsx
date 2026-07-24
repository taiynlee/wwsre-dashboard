import { useEffect, useState, type RefObject } from 'react'

/** Draws a bright animated line between two DOM elements (a map pin and its
 * site card) inside a shared relatively-positioned container. Recomputes on
 * resize/scroll since it works in real pixel coordinates. `toSide` picks
 * which edge of the target card the line lands on — cards to the right of
 * the map read better landing on their left edge, cards below the map on
 * their top edge. */
export function ConnectorLine({
  containerRef,
  fromEl,
  toEl,
  toSide = 'top',
}: {
  containerRef: RefObject<HTMLElement | null>
  fromEl: Element | null | undefined
  toEl: Element | null | undefined
  toSide?: 'top' | 'left'
}) {
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  useEffect(() => {
    if (!fromEl || !toEl || !containerRef.current) {
      setLine(null)
      return
    }

    const recompute = () => {
      const container = containerRef.current
      if (!container) return
      const cRect = container.getBoundingClientRect()
      const fRect = fromEl.getBoundingClientRect()
      const tRect = toEl.getBoundingClientRect()
      const target =
        toSide === 'left'
          ? { x: tRect.left - cRect.left, y: tRect.top + tRect.height / 2 - cRect.top }
          : { x: tRect.left + tRect.width / 2 - cRect.left, y: tRect.top - cRect.top }
      setLine({
        x1: fRect.left + fRect.width / 2 - cRect.left,
        y1: fRect.top + fRect.height / 2 - cRect.top,
        x2: target.x,
        y2: target.y,
      })
    }

    recompute()
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [fromEl, toEl, containerRef, toSide])

  if (!line) return null

  // Bend the curve along whichever axis the approach is on: vertical S-curve
  // for a top-edge landing, horizontal S-curve for a left-edge landing.
  const d =
    toSide === 'left'
      ? (() => {
          const midX = (line.x1 + line.x2) / 2
          return `M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`
        })()
      : (() => {
          const midY = (line.y1 + line.y2) / 2
          return `M ${line.x1} ${line.y1} C ${line.x1} ${midY}, ${line.x2} ${midY}, ${line.x2} ${line.y2}`
        })()

  return (
    <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full overflow-visible">
      <defs>
        <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={2.5}
        strokeDasharray="7 6"
        strokeLinecap="round"
        filter="url(#connector-glow)"
        className="motion-safe:[animation:connector-flow_0.7s_linear_infinite]"
      />
      <circle cx={line.x1} cy={line.y1} r={4} fill="var(--color-accent)" filter="url(#connector-glow)" />
      <circle cx={line.x2} cy={line.y2} r={4} fill="var(--color-accent)" filter="url(#connector-glow)" />
    </svg>
  )
}
