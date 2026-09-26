import { useEffect, useState } from 'react'
import { create } from 'zustand'

/** A tick's beat, ms: its button becomes the green circle (about 300 ms), and the tick is there to be seen */
export const TICK_BEAT_MS = 1000

/**
 * A confirming tick (the book button's, the cancel button's) has its beat
 * before anything else moves: until `until` (performance.now(), ms) what it
 * confirmed stays as it is, however soon the change comes back from the
 * server or a live update brings it.
 */
export const useTickBeat = create<{ until: number; start: (ms?: number) => void }>((set) => ({
  until: 0,
  start: (ms = TICK_BEAT_MS) => set({ until: performance.now() + ms }),
}))

/** Whether a tick is still having its beat */
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

/** A value that holds still while a tick has its beat, and follows once it is over */
export function useAfterTickBeat<T>(value: T): T {
  const beating = useTickBeating()
  const [kept, setKept] = useState(value)
  if (!beating && value !== kept) setKept(value)
  return beating ? kept : value
}
