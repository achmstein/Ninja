/**
 * Where the book button's tick sits when a hold goes through, and when its
 * beat is over, for the reservation to grow out of it right then
 * (components/places/reservation-shape). Taken once, and only while fresh:
 * a hold made in the scan sheet, away from the tab, must not have the next
 * one grow from where that was.
 */
type Box = { x: number; y: number; width: number; height: number }

let origin: { rect: Box; release: number } | null = null

export const holdOrigin = {
  /** The tick's box, and how long its beat still has to run, ms */
  set(rect: Box, beatMs: number) {
    origin = { rect, release: performance.now() + beatMs }
  },
  /** The box, and the delay before growing out of it, s */
  take(): { rect: Box; delay: number } | null {
    const now = performance.now()
    const taken = origin && now - origin.release < 3000 ? { rect: origin.rect, delay: Math.max(0, (origin.release - now) / 1000) } : null
    origin = null
    return taken
  },
}
