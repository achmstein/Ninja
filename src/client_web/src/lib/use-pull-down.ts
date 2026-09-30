import { useEffect, useRef, type RefObject } from 'react'

/** How far a finger goes down, px, before a pull that began at the top is the sheet's rather than a tap */
const PULL_SLOP = 6

export type PullDown = {
  /** The pull has begun: the event it began on (a motion drag can be started from it) */
  onStart: (event: PointerEvent) => void
  /** How far down it has gone since it began, px */
  onMove?: (offsetY: number) => void
  /** Let go: how far down it went and how fast it was going at the end, px and px/s (down is positive) */
  onEnd?: (offsetY: number, velocityY: number) => void
}

/**
 * A bottom sheet goes down from anywhere on it, not only by its handle, as
 * sheets do everywhere: a pull down that starts where nothing under the
 * finger is scrolled down (the sheet's list at its top, or nothing that
 * scrolls) is the sheet's. Anything else stays what it was: a scroll through
 * a list (once scrolled down, a pull down scrolls back up), a pull up, a
 * sideways swipe, a tap. On a touch screen the pull is kept from the browser
 * (its first move is held back), or the browser would take the finger for
 * its own scroll and the pull would never reach the sheet.
 */
export function usePullDown(sheet: RefObject<HTMLElement | null>, on: boolean, pull: PullDown) {
  // The latest callbacks, so the listeners stay put while the sheet renders
  const latest = useRef(pull)
  useEffect(() => {
    latest.current = pull
  })

  useEffect(() => {
    const el = sheet.current
    if (!on || !el) return
    // Where a finger went down with nothing under it scrolled; null once it is not a pull
    let start: { x: number; y: number } | null = null
    let pulling = false
    let last = { y: 0, t: 0 }
    let velocity = 0

    const down = (e: PointerEvent) => {
      pulling = false
      velocity = 0
      start = e.isPrimary && e.button === 0 && atTop(e.target, el) ? { x: e.clientX, y: e.clientY } : null
    }
    const move = (e: PointerEvent) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      if (!pulling) {
        // Sideways, or up: not the sheet's
        if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
          start = null
          return
        }
        if (dy <= PULL_SLOP) return
        pulling = true
        last = { y: e.clientY, t: e.timeStamp }
        latest.current.onStart(e)
      }
      const dt = e.timeStamp - last.t
      if (dt > 0) velocity = ((e.clientY - last.y) / dt) * 1000
      last = { y: e.clientY, t: e.timeStamp }
      latest.current.onMove?.(Math.max(0, dy))
    }
    const up = (e: PointerEvent) => {
      if (start && pulling) {
        // A finger held still before letting go is not a flick
        const still = e.timeStamp - last.t > 80
        // A cancelled pointer's position means nothing: it ends where it was last seen
        const y = e.type === 'pointercancel' ? last.y : e.clientY
        latest.current.onEnd?.(Math.max(0, y - start.y), still ? 0 : velocity)
      }
      start = null
      pulling = false
    }
    // A downward first move where nothing is scrolled is the sheet's: held from the browser, so it does not claim the finger
    const touchMove = (e: TouchEvent) => {
      if (!e.cancelable || !start) return
      const touch = e.touches[0]
      if (pulling || (touch && touch.clientY > start.y && touch.clientY - start.y >= Math.abs(touch.clientX - start.x))) e.preventDefault()
    }

    el.addEventListener('pointerdown', down, { passive: true })
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerup', up, { passive: true })
    window.addEventListener('pointercancel', up, { passive: true })
    el.addEventListener('touchmove', touchMove, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      el.removeEventListener('touchmove', touchMove)
    }
  }, [sheet, on])
}

/** Nothing between the finger and the sheet is scrolled down (a list at its top, a text field, or nothing that scrolls) */
function atTop(target: EventTarget | null, sheet: HTMLElement): boolean {
  for (let node = target instanceof Element ? target : null; node && node !== sheet.parentElement; node = node.parentElement) {
    if (node instanceof HTMLElement && node.scrollTop > 0) return false
    // A handle drags the sheet itself (`data-pull-handle`)
    if (node instanceof HTMLElement && node.dataset.pullHandle != null) return false
    // A range or a text box keeps its own finger
    if (node instanceof HTMLInputElement && node.type === 'range') return false
    if (node instanceof HTMLTextAreaElement) return false
  }
  return true
}
