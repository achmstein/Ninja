import { useLayoutEffect, useRef } from 'react'
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react'

/** The edge that leads snaps over quickly; the one behind catches up softer, so the pill stretches and settles like a drop. */
const LEADING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 } as const
const TRAILING = { type: 'spring', stiffness: 190, damping: 24, mass: 0.9 } as const

export type LiquidEdges = { left: MotionValue<number>; right: MotionValue<number> }

/**
 * The two edges of a pill that sits under the active one of a row of
 * elements, measured in the row's own box (so a right-to-left row works
 * unchanged). Moving to another element, the edge on the side it moves
 * towards leads and the other trails; the first placement and reduced
 * motion jump. Also follows the row when its size changes (fonts landing).
 */
export function useLiquidEdges(active: number, items: React.RefObject<Array<HTMLElement | null>>, row: React.RefObject<HTMLElement | null>): LiquidEdges {
  const reduced = useReducedMotion()
  const left = useMotionValue(0)
  const right = useMotionValue(0)
  const placed = useRef(false)

  useLayoutEffect(() => {
    const el = items.current?.[active]
    if (!el) return
    const to = { l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth }
    if (!placed.current || reduced) {
      left.jump(to.l)
      right.jump(to.r)
      placed.current = true
      return
    }
    const forward = to.l > left.get()
    const a = animate(left, to.l, forward ? TRAILING : LEADING)
    const b = animate(right, to.r, forward ? LEADING : TRAILING)
    return () => {
      a.stop()
      b.stop()
    }
  }, [active, reduced, items, left, right])

  useLayoutEffect(() => {
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const item = items.current?.[active]
      if (!item) return
      left.jump(item.offsetLeft)
      right.jump(item.offsetLeft + item.offsetWidth)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, items, row, left, right])

  return { left, right }
}
