import { useLayoutEffect, useRef } from 'react'
import { animate, useMotionValue, useReducedMotion, type MotionValue } from 'motion/react'

/** The edge that leads snaps over quickly; the one behind catches up softer, so the pill stretches and settles like a drop. */
const LEADING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.7 } as const
const TRAILING = { type: 'spring', stiffness: 190, damping: 24, mass: 0.9 } as const

export type LiquidEdges = { left: MotionValue<number>; right: MotionValue<number> }

/**
 * Where a remembered pill last sat. The app's tabs are drawn by a different
 * row on the menu (inside the tray's dock) and on every other page, so on a
 * change of page the new row starts its pill where the old one left it and
 * slides to its own tab, instead of appearing there.
 */
const remembered = new Map<string, { l: number; r: number }>()

/**
 * The two edges of a pill that sits under the active one of a row of
 * elements, measured in the row's own box (so a right-to-left row works
 * unchanged). Moving to another element, the edge on the side it moves
 * towards leads and the other trails; the first placement and reduced
 * motion jump. Also follows the row and its elements when their sizes
 * change (fonts landing, a tab appearing or going), and `layout` names the
 * set of elements so a change to it measures again. With `memory`, a new
 * row picks up where the last row of that name left its pill.
 */
export function useLiquidEdges(
  active: number,
  items: React.RefObject<Array<HTMLElement | null>>,
  row: React.RefObject<HTMLElement | null>,
  layout = '',
  memory?: string
): LiquidEdges {
  const reduced = useReducedMotion()
  const left = useMotionValue(0)
  const right = useMotionValue(0)
  const placed = useRef(false)

  useLayoutEffect(() => {
    const el = items.current?.[active]
    if (!el) return
    const to = { l: el.offsetLeft, r: el.offsetLeft + el.offsetWidth }
    const before = memory ? remembered.get(memory) : undefined
    if (memory) remembered.set(memory, to)
    if (!placed.current && before && !reduced && (before.l !== to.l || before.r !== to.r)) {
      left.jump(before.l)
      right.jump(before.r)
      placed.current = true
    }
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
  }, [active, reduced, items, left, right, layout, memory])

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
    for (const item of items.current ?? []) if (item) observer.observe(item)
    return () => observer.disconnect()
  }, [active, items, row, left, right, layout])

  return { left, right }
}
