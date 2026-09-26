import { type ReactNode } from 'react'
import { motion } from 'motion/react'
import { recede } from '@/lib/motion'

/**
 * A part of a page that steps back while something opens over it, a little
 * smaller and fading, and comes back as that closes (useRecede for a part
 * that takes its opacity as a value). Transform and opacity only, which the
 * compositor moves without redrawing what it holds.
 */
export function Recede({ gone, children }: { gone: boolean; children: ReactNode }) {
  return (
    <motion.div initial={false} animate={{ opacity: gone ? 0 : 1, scale: gone ? 0.96 : 1 }} transition={gone ? recede.go : recede.back}>
      {children}
    </motion.div>
  )
}
