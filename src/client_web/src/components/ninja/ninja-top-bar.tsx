import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { blurSwap, spring } from '@/lib/motion'
import { useIsland } from '@/lib/island'
import { cn } from '@/lib/utils'
import { BrandWordmark } from '@/components/brand-mark'
import { BranchSwitcher } from '@/components/branch-switcher'
import { ScanCodeButton } from '@/components/places/table-scanner'
import { NINJA_BAR_H } from './chrome'

/**
 * The top bar in the Ninja style's chrome: slim and see-through, so the page
 * runs on under it. The island (lib/island.ts) lives in its end corner:
 * while it is up the place chips step aside, and they come back when it goes. `start` replaces the brand (a way back);
 * `title`, once set, takes the wordmark's place (a page's own title, handed
 * up as its large title scrolls away). `chips` off leaves the end empty, for
 * a pushed page.
 */
export function NinjaTopBar({
  start,
  title,
  chips = true,
  className,
}: {
  start?: ReactNode
  title?: string | null
  chips?: boolean
  className?: string
}) {
  // The island's slot is taken: by the order pill, or by a toast for a moment
  // The island is up in the chips' corner (the order's status, or a message for a moment)
  const pill = useIsland((s) => s.busy)
  const swap = blurSwap(useReducedMotion())
  const brand = (
    <Link to='/' className='flex min-w-0 items-center'>
      <AnimatePresence mode='popLayout' initial={false}>
        {title ? (
          <motion.span key='title' {...swap} className='heading truncate text-[calc(1.15rem*var(--heading-scale))]'>
            {title}
          </motion.span>
        ) : (
          <motion.span key='word' {...swap} className='flex min-w-0 items-center gap-2'>
            <BrandWordmark className='max-w-[50vw]' />
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
  return (
    <div
      className={cn(
        'bg-background/70 z-30 mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-4 backdrop-blur-xl backdrop-saturate-150',
        className
      )}
      style={{ height: NINJA_BAR_H }}
    >
      <div className='flex min-w-0 items-center gap-1'>{start ?? brand}</div>
      {chips && (
        <motion.div
          className='flex shrink-0 items-center gap-2 empty:hidden'
          animate={{ opacity: pill ? 0 : 1, scale: pill ? 0.9 : 1 }}
          transition={spring}
          style={{ pointerEvents: pill ? 'none' : undefined }}
          aria-hidden={pill || undefined}
        >
          {/* Where the customer is (the table, the branch they are at) the dock's row says; here, while they are at
              none, the way to scan a table's or a room's code, and the switch of branch */}
          <BranchSwitcher />
          <ScanCodeButton />
        </motion.div>
      )}
    </div>
  )
}
