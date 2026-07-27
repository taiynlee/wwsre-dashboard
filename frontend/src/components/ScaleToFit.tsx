import { useEffect, useRef, useState, type ReactNode } from 'react'

const DESIGN_WIDTH = 1360

/** Renders children at a fixed design width, then visually scales the whole
 * thing down (as one unit — text, gaps, borders, everything together) to fit
 * whatever width is actually available. This keeps every element's relative
 * proportions identical to the full-size layout instead of letting things
 * reflow/truncate awkwardly on a narrow window — it's a uniform zoom, not a
 * responsive re-layout. Never scales up past 1 (wide screens still show the
 * design-width layout, centered, same as before). */
export function ScaleToFit({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [naturalHeight, setNaturalHeight] = useState(0)
  const [marginLeft, setMarginLeft] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const recompute = () => {
      const availableWidth = outer.clientWidth
      const nextScale = Math.min(1, availableWidth / DESIGN_WIDTH)
      setScale(nextScale)
      setNaturalHeight(inner.scrollHeight)
      setMarginLeft(Math.max(0, (availableWidth - DESIGN_WIDTH * nextScale) / 2))
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(outer)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={outerRef} style={{ height: naturalHeight * scale || undefined, overflow: 'hidden' }}>
      <div
        ref={innerRef}
        style={{ width: DESIGN_WIDTH, marginLeft, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {children}
      </div>
    </div>
  )
}
