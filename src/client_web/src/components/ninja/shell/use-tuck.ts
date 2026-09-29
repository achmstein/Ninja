import { useEffect } from 'react'
import { create } from 'zustand'

/**
 * The dock tucked away while the customer reads on: scrolling down folds
 * the tabs (the tray or the bill's row staying, as what can be acted on
 * now), and the dock goes whole again on scrolling back up, or at the
 * page's end. One flag for the whole app, set by whichever scroller is
 * the page's.
 */
export const useTuck = create<{ tucked: boolean }>(() => ({ tucked: false }))

/** How far from the top a scroll down starts to tuck, px: the top bar's worth, so a nudge does not */
const TUCK_AFTER = 64

/** How far a scroll must run one way before the dock follows it, px: a finger's jitter does not */
const TUCK_SLACK = 12

/** How long the dock takes to fold or grow, ms (its transition), during which its own effect on the scroll is ignored */
export const SETTLE_MS = 300

/** How long the page must be still at its end before the dock comes back, ms: a beat, so a flick past the end does not flash it */
const REST_MS = 220

/** The tuck a scroll to `y` (of `max`) makes, given where the last turn began and the tuck till now */
export function tuckAt(y: number, max: number, from: number, tucked: boolean): { tucked: boolean; from: number } {
  // At the top, or at the end (nothing more to read), the dock is whole
  if (y <= TUCK_AFTER || y >= max - 2) return { tucked: false, from: y }
  // The anchor follows the scroll in the way the dock already agrees with
  if (tucked ? y > from : y < from) return { tucked, from: y }
  if (Math.abs(y - from) < TUCK_SLACK) return { tucked, from }
  return { tucked: !tucked, from: y }
}

/**
 * Tucks the dock as `target` scrolls (an element, or the window when none
 * is given), and untucks it when that scroller goes. `enabled` off keeps
 * the dock whole (a paged deck, an open order).
 */
export function useTuckOnScroll(target: HTMLElement | null | undefined, enabled = true) {
  useEffect(() => {
    if (!enabled) {
      useTuck.setState({ tucked: false })
      return
    }
    const source: HTMLElement | Window = target ?? window
    const read = () =>
      target
        ? { y: target.scrollTop, max: target.scrollHeight - target.clientHeight }
        : { y: window.scrollY, max: document.documentElement.scrollHeight - window.innerHeight }
    let from = read().y
    // The dock folding or growing can resize the scroller (the menu's sits over it) and clamp its
    // scroll; while it moves, the scroll it causes is not the customer's
    let quietUntil = 0
    // Once the page has come to rest at its end (or its top), the dock comes back whole: scroll events
    // stop there, so one swallowed while the dock was still folding (or never sent, a short page
    // reaching its end in one flick) must not leave the tabs away with nothing more to read
    let rest: number | null = null
    const atRest = () => {
      rest = null
      const { y, max } = read()
      if ((y <= TUCK_AFTER || y >= max - 2) && useTuck.getState().tucked) {
        from = y
        quietUntil = performance.now() + SETTLE_MS
        useTuck.setState({ tucked: false })
      }
    }
    const onScroll = () => {
      if (rest !== null) window.clearTimeout(rest)
      rest = window.setTimeout(atRest, REST_MS)
      const { y, max } = read()
      if (performance.now() < quietUntil) {
        from = y
        return
      }
      const next = tuckAt(y, max, from, useTuck.getState().tucked)
      from = next.from
      if (next.tucked !== useTuck.getState().tucked) {
        quietUntil = performance.now() + SETTLE_MS
        useTuck.setState({ tucked: next.tucked })
      }
    }
    source.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      source.removeEventListener('scroll', onScroll)
      if (rest !== null) window.clearTimeout(rest)
      useTuck.setState({ tucked: false })
    }
  }, [target, enabled])
}
