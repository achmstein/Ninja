import { useEffect } from 'react'
import { animate, useMotionValue, type MotionValue } from 'motion/react'
import { recede } from '@/lib/motion'

/** Recede's going and coming back as a value, for a part that takes its opacity as one (a page's large title) */
export function useRecede(gone: boolean): MotionValue<number> {
  const shown = useMotionValue(gone ? 0 : 1)
  useEffect(() => {
    const run = animate(shown, gone ? 0 : 1, gone ? recede.go : recede.back)
    return () => run.stop()
  }, [gone, shown])
  return shown
}
