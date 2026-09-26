import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A one-line cue in the dock's colours. It rises in and fades out; under
 * reduced motion it only fades (the Counter's MotionConfig drops the rise).
 * Put it inside an AnimatePresence.
 */
export function HintBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      role='status'
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      className={cn(
        'bg-foreground text-background pointer-events-none flex w-max max-w-[calc(100vw-3rem)] items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
