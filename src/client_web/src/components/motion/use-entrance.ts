import { useEffect } from 'react'
import { animate, useMotionValue, type MotionValue } from 'motion/react'
import { ease } from '@/lib/motion'

/**
 * A 0→1 clock for a view's parts to come in on, started as the view
 * mounts, a moment after the view itself has started to open.
 */
export function useEntrance({ delay = 0.08, duration = 0.55 }: { delay?: number; duration?: number } = {}): MotionValue<number> {
  const clock = useMotionValue(0)
  useEffect(() => {
    const run = animate(clock, 1, { duration, ease: ease.enter, delay })
    return () => run.stop()
  }, [clock, delay, duration])
  return clock
}
