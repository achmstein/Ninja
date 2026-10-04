import { useEffect, useState } from 'react'

/** The value as it stood `delayMs` after it last changed: one lookup per pause in typing, not per key */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}
