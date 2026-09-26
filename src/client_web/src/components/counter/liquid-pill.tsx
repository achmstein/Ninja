import { motion, useTransform } from 'motion/react'
import { cn } from '@/lib/utils'
import type { LiquidEdges } from './use-liquid'

/**
 * The pill under the active tab: two round caps and a bar between them,
 * each moved only by transform, so it can stretch between its two edges
 * without its round ends ever going oval.
 */
export function LiquidPill({ edges, height, top = 0, className }: { edges: LiquidEdges; height: number; top?: number; className?: string }) {
  const { left, right } = edges
  const middleX = useTransform(left, (l) => l + height / 2)
  const middleScale = useTransform(() => Math.max(0, right.get() - left.get() - height))
  const endX = useTransform(right, (r) => r - height)
  const piece = cn('pointer-events-none absolute left-0', className)
  return (
    <>
      <motion.span aria-hidden className={cn(piece, 'rounded-full')} style={{ x: left, top, width: height, height }} />
      <motion.span aria-hidden className={cn(piece, 'origin-left')} style={{ x: middleX, scaleX: middleScale, top, width: 1, height }} />
      <motion.span aria-hidden className={cn(piece, 'rounded-full')} style={{ x: endX, top, width: height, height }} />
    </>
  )
}
