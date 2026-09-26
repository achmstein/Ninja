import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The height of what a box holds, followed as it changes, for a container
 * that springs its own height to it. Animating the height itself, rather
 * than a layout animation's scale, keeps the text and the rings inside
 * from stretching on the way. 'auto' until first measured.
 */
export function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [height, setHeight] = useState<number | 'auto'>('auto')
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // The observer reports once on observe, then on every change
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, height] as const
}
