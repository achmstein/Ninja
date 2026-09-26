import { type ReactNode } from 'react'
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { progressWindow } from '@/lib/motion'

/**
 * One part of a view on its own beat: it rises and fades in over its window
 * of the clock (useEntrance; `at` to `at + span`), and out the same way. Transform and
 * opacity only. Without a clock it is simply there.
 */
export function Beat({
  clock,
  at,
  span = 0.35,
  className,
  children,
}: {
  clock?: MotionValue<number>
  at: number
  span?: number
  className?: string
  children: ReactNode
}) {
  const still = useMotionValue(1)
  const shown = useTransform(clock ?? still, (v) => progressWindow(v, at, at + span))
  const y = useTransform(shown, (v) => (1 - v) * 14)
  return (
    <motion.div className={className} style={{ opacity: shown, y }}>
      {children}
    </motion.div>
  )
}
