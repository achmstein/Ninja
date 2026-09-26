import { useEffect, useState } from 'react'
import { create } from 'zustand'

/** A tick's beat, ms: its button becomes the green circle (about 300 ms), and the tick is there to be seen */
export const TICK_BEAT_MS = 1000

/**
 * A tick has its beat before anything else moves: until `until`
 * (performance.now(), ms) the reservation stays as it is, shut while the
 * book button's tick shows, open while the cancel button's does, however
 * soon the change comes back from the server or a live update brings it.
 */
export const useTickBeat = create<{ until: number; start: (ms: number) => void }>((set) => ({
  until: 0,
  start: (ms) => set({ until: performance.now() + ms }),
}))

/** Whether the tick is still having its beat */
export function useTickBeating(): boolean {
  const until = useTickBeat((s) => s.until)
  // The last beat that has run out; a newer `until` is a beat still running
  const [over, setOver] = useState(0)
  useEffect(() => {
    if (until === 0) return
    const timer = window.setTimeout(() => setOver(until), Math.max(0, until - performance.now()))
    return () => window.clearTimeout(timer)
  }, [until])
  return until > over
}
