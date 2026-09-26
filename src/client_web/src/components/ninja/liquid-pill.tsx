import { motion, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'
import type { LiquidEdges } from './use-liquid'

/**
 * The pill under the active tab: one rounded piece placed at the left edge
 * and as wide as the gap to the right edge, so it stretches between the two
 * springs and can never come apart.
 */
export function LiquidPill({ edges, height, top = 0, className }: { edges: LiquidEdges; height: number; top?: number; className?: string }) {
  const { left, right } = edges
  const width = useTransform(() => Math.max(height, right.get() - left.get()))
  return (
    <motion.span
      aria-hidden
      className={cn('pointer-events-none absolute left-0 rounded-full', className)}
      style={{ x: left, width, top, height }}
    />
  )
}
