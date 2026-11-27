import { useState } from 'react'
import { ChevronDown, Timer } from 'lucide-react'
import type { StayViewModel } from '@/api/spaces/types.gen'
import { useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { StayBar } from './stay-bar'
import { elapsedSeconds, estimateStayCost, formatClock } from './status'
import { useSecondsClock } from './use-places'

/**
 * The room's running clock as one line at the top of the order: how long and
 * about how much, always in sight while items are rung up. A tap opens the
 * rest (the rate, the people, the way to end it) under it and closes it again,
 * so the menu keeps the room the whole panel used to take.
 */
export function StayStrip({ stay }: { stay: StayViewModel }) {
  const money = useMoney()
  const now = useSecondsClock(true)
  const [open, setOpen] = useState(false)
  const estimate = estimateStayCost(stay, now)

  return (
    <div className='bg-muted/50 rounded-lg'>
      <button
        type='button'
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className='flex min-h-12 w-full items-center gap-2 px-3 py-2 text-start'
      >
        <Timer className='text-primary size-5 shrink-0' aria-hidden />
        <span className='type-title tabular-nums'>{formatClock(elapsedSeconds(stay, now))}</span>
        <span className='text-muted-foreground min-w-0 flex-1 type-detail truncate tabular-nums'>≈ {money(estimate.amount)}</span>
        <ChevronDown className={cn('text-muted-foreground size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        // The panel has its own clock line: only the rate, the people and the way to end it are new here
        <div className='border-t p-3'>
          <StayBar stay={stay} clock={false} />
        </div>
      )}
    </div>
  )
}
