import { useEffect, useState } from 'react'

// A ticking "now" for live idle timers. 10s granularity keeps minute
// displays feeling live without meaningful render cost.
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
