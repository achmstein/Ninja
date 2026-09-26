import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { blurSwap, spring } from '@/lib/motion'
import { useOrderPill } from '@/lib/order-pill'
import { cn } from '@/lib/utils'
import { BrandMark, BrandWordmark } from '@/components/brand-mark'
import { DestinationChip } from '@/components/places/place-chip'
import { BranchSwitcher } from '@/components/branch-switcher'
import { COUNTER_BAR_H } from './chrome'

/**
 * The top bar in the Counter's chrome: slim and see-through, so the cards
 * run on under it. The order pill lives in its middle: while the pill is on
 * screen the wordmark folds to the mark and the place chips step aside, and
 * they come back when it goes. `start` replaces the brand (the way back from
 * the whole menu).
 */
export function CounterTopBar({ start, className }: { start?: ReactNode; className?: string }) {
  const pill = useOrderPill((s) => s.onScreen)
  const swap = blurSwap(useReducedMotion())
  return (
    <div
      className={cn(
        'bg-background/70 z-30 mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 backdrop-blur-xl backdrop-saturate-150 md:hidden',
        className
      )}
      style={{ height: COUNTER_BAR_H }}
    >
      <div className='flex min-w-0 items-center'>
        {start ?? (
          <Link to='/' className='flex min-w-0 items-center'>
            <AnimatePresence mode='popLayout' initial={false}>
              {pill ? (
                <motion.span key='mark' {...swap}>
                  <BrandMark className='size-9 rounded-xl text-base' />
                </motion.span>
              ) : (
                <motion.span key='word' {...swap} className='flex min-w-0'>
                  <BrandWordmark className='max-w-[50vw]' />
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        )}
      </div>
      <motion.div
        className='flex shrink-0 items-center gap-2 empty:hidden'
        animate={{ opacity: pill ? 0 : 1, scale: pill ? 0.9 : 1 }}
        transition={spring}
        style={{ pointerEvents: pill ? 'none' : undefined }}
        aria-hidden={pill || undefined}
      >
        <DestinationChip />
        <BranchSwitcher />
      </motion.div>
    </div>
  )
}
