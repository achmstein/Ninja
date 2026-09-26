import { useLayoutEffect } from 'react'
import { motion, useMotionValue } from 'motion/react'
import { cn } from '@/lib/utils'
import type { LiquidEdges } from './use-liquid'

/**
 * The pill under the active tab: one rounded piece placed at the left edge
 * and as wide as the gap to the right edge, so it stretches between the two
 * springs and can never come apart.
 */
export function LiquidPill({ edges, height, top = 0, className }: { edges: LiquidEdges; height: number; top?: number; className?: string }) {
  const { left, right } = edges
  const width = useMotionValue(height)
  // Subscribed in a layout effect, which runs before the row's own: the row
  // places the edges in its layout effect, and a pill that mounted fresh
  // (back from the whole menu) listening any later missed that and stayed a circle
  useLayoutEffect(() => {
    const follow = () => width.set(Math.max(height, right.get() - left.get()))
    follow()
    const offLeft = left.on('change', follow)
    const offRight = right.on('change', follow)
    return () => {
      offLeft()
      offRight()
    }
  }, [left, right, width, height])
  return (
    <motion.span
      aria-hidden
      className={cn('pointer-events-none absolute left-0 rounded-full', className)}
      style={{ x: left, width, top, height }}
    />
  )
}
