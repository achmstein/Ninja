import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

/** A press held this long without wandering is a long press */
export const LONG_PRESS_MS = 480
/** How far a finger may drift before the press is a scroll instead, px */
const DRIFT = 10

/**
 * Tap and long press on one element that also sits in a scroller: moving
 * past the drift cancels (the finger is scrolling), and the click that ends
 * a long press is swallowed so it does not also open the card.
 */
export function usePress({ onTap, onLongPress }: { onTap: () => void; onLongPress?: () => void }) {
  const timer = useRef<number | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)
  const [pressing, setPressing] = useState(false)

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
    start.current = null
    setPressing(false)
  }

  useEffect(() => cancel, [])

  return {
    pressing,
    handlers: {
      onPointerDown: (e: ReactPointerEvent) => {
        if (e.button !== 0 || !e.isPrimary) return
        fired.current = false
        start.current = { x: e.clientX, y: e.clientY }
        setPressing(true)
        if (!onLongPress) return
        timer.current = window.setTimeout(() => {
          timer.current = null
          fired.current = true
          setPressing(false)
          onLongPress()
        }, LONG_PRESS_MS)
      },
      onPointerMove: (e: ReactPointerEvent) => {
        if (!start.current) return
        if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > DRIFT) cancel()
      },
      onPointerUp: () => {
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = null
        start.current = null
        setPressing(false)
      },
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onClick: () => {
        if (fired.current) {
          fired.current = false
          return
        }
        onTap()
      },
      // A long press on a phone would otherwise open the image menu
      onContextMenu: (e: ReactMouseEvent) => {
        if (onLongPress) e.preventDefault()
      },
    },
  }
}
