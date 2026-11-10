import { useEffect, useState } from 'react'

/** Milliseconds since the page woke; 0 where there is no page (the build's render) */
export const now = () => (typeof performance === 'undefined' ? 0 : performance.now())

/**
 * The page's time, read every `every` ms. It is 0 on the first render, the
 * build's and the browser's alike, so what was rendered at build is what the
 * browser wakes; the clocks start moving a tick later.
 */
export function useNow(every = 1000): number {
  const [at, setAt] = useState(0)
  useEffect(() => {
    const tick = () => setAt(now())
    tick()
    const id = window.setInterval(tick, every)
    return () => window.clearInterval(id)
  }, [every])
  return at
}

/** Minutes and seconds between two of the page's times: 6:10 */
export function elapsed(from: number, to: number): string {
  const secs = Math.max(0, Math.floor((to - from) / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
}
