import type { ReactNode, Ref } from 'react'
import { Link } from '@tanstack/react-router'
import { motion, type MotionStyle } from 'motion/react'
import { spring } from '@/lib/motion'
import { useIsland } from '@/lib/island'
import { cn } from '@/lib/utils'
import { BrandWordmark } from '@/components/brand/brand-mark'
import { BranchSwitcher } from '@/components/branch-switcher'
import { ScanCodeButton } from '@/components/places/table-scanner'

/**
 * The top bar in the Ninja style's chrome: slim, and the top of what it is
 * on, so it scrolls away with it rather than keeping a small screen's room.
 * The island (lib/island.ts) lives in its end corner, floating on when the
 * bar has gone: while it is up the place chips step aside, and they come
 * back when it goes. `start` replaces the brand (a way back); `chips` off
 * leaves the end empty, for a pushed page.
 */
export function NinjaTopBar({
  start,
  end,
  chips = true,
  className,
  style,
  ref,
}: {
  start?: ReactNode
  /** Something of the page's own at the end, before the chips (the menu's search) */
  end?: ReactNode
  chips?: boolean
  className?: string
  style?: MotionStyle
  ref?: Ref<HTMLDivElement>
}) {
  // The island is up in the chips' corner (the order's status, or a message for a moment)
  const pill = useIsland((s) => s.busy)
  const brand = (
    <Link to='/' className='flex min-w-0 items-center gap-2'>
      {/* However tall the business made its logo, it keeps room above and below it in the bar */}
      <BrandWordmark className='max-h-[calc(var(--bar-h)-1.25rem)] max-w-[50vw]' />
    </Link>
  )
  return (
    <motion.div
      ref={ref}
      // As tall as the business's header (--bar-h, styles/theme.css), so every brand's logo sits with room round it
      className={cn('bg-background z-30 mx-auto flex h-(--bar-h) w-full max-w-lg items-center justify-between gap-3 px-4', className)}
      style={style}
    >
      <div className='flex min-w-0 items-center gap-1'>{start ?? brand}</div>
      {end && <div className='ms-auto flex shrink-0 items-center'>{end}</div>}
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
    </motion.div>
  )
}
