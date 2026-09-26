/**
 * Where the book button's tick sat when a hold went through, for the
 * reservation to grow out of it (components/places/reservation-shape).
 * Taken once, and only while fresh: a hold made in the scan sheet, away
 * from the tab, must not have the next one grow from where that was.
 */
let origin: { rect: DOMRect; at: number } | null = null

export const holdOrigin = {
  set(rect: DOMRect | null | undefined) {
    origin = rect ? { rect, at: performance.now() } : null
  },
  take(): DOMRect | null {
    const taken = origin && performance.now() - origin.at < 3000 ? origin.rect : null
    origin = null
    return taken
  },
}
