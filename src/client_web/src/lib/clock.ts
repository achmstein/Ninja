import { useEffect, useState } from 'react'

/**
 * How far the server's clock is ahead of this phone's, ms. A phone set by
 * hand, or to the wrong zone, can be minutes or hours off; a clock counting
 * from a start the server stamped would then sit at 0:00 (the start looks
 * to be in the future) or run hours ahead. Every answer from the API carries
 * the server's time (its Date header), noted here as it comes back.
 */
let skew = 0

/** A gap this small is the header's whole seconds and the trip's own time, not a wrong clock, ms */
const SKEW_AFTER_MS = 5000

/** Notes the server's time from an answer's Date header, just received */
export function noteServerDate(header: unknown): void {
  const server = typeof header === 'string' ? Date.parse(header) : NaN
  if (Number.isNaN(server)) return
  // The header is cut to the second: its middle is the better guess
  const gap = server + 500 - Date.now()
  skew = Math.abs(gap) > SKEW_AFTER_MS ? gap : 0
}

/** The time now by the server's clock, ms: what anything counting from a server's stamp should count to */
export function serverNow(): number {
  return Date.now() + skew
}

/** The time now (by the server's clock), moving on each second while `on`; still otherwise, so an idle page does not re-render */
export function useSecondTick(on = true): number {
  const [now, setNow] = useState(serverNow)
  useEffect(() => {
    if (!on) return
    const timer = window.setInterval(() => setNow(serverNow()), 1000)
    return () => window.clearInterval(timer)
  }, [on])
  return now
}

/** Seconds as a clock: m:ss under an hour, h:mm:ss from there */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}
