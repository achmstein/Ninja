import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranchFlags } from '@/features/branch/use-branch-flags'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'
import { ShiftPanel } from './shift-panel'
import { useCurrentShift } from './use-current-shift'

/**
 * Header status chip: one plain outline button that reads the day — a
 * status dot plus the shift's open time, muted "No shift" when none, and an
 * amber "Paused" when the store has stopped taking orders or reservations
 * mid-shift. Tap → the shift panel (open/close the shift, the pause
 * switches, the X report). Quiet while the first answer is still loading.
 * The dot does the signalling so the chip keeps the same surface, border
 * and foreground as every other control in the chrome.
 */
export function ShiftChip() {
  const t = useT()
  const locale = useLocale()
  const [panelOpen, setPanelOpen] = useState(false)
  const { shift, noShift } = useCurrentShift({ refetchInterval: 60_000 })
  const { paused } = useBranchFlags()

  // Neither the shift nor the 404 has landed yet — the first load, or right
  // after a branch switch resets every query. Hold the chip's place with a
  // neutral placeholder so the header never flickers out and back.
  if (!shift && !noShift) {
    return (
      <Button variant='outline' className='h-12 gap-2 px-4' disabled>
        <span aria-hidden className='bg-muted-foreground/40 size-2 rounded-full' />
        <Skeleton className='h-4 w-20' />
      </Button>
    )
  }

  const openedAt = shift?.openedAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
        new Date(shift.openedAt)
      )
    : ''
  const showPaused = !!shift && paused

  return (
    <>
      <Button
        variant='outline'
        className='h-12 gap-2 px-4'
        onClick={() => setPanelOpen(true)}
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            !shift
              ? 'bg-muted-foreground/40'
              : showPaused
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          )}
        />
        <span className='text-sm font-medium tabular-nums'>
          {shift ? `${t('shiftTitle')} ${openedAt}` : t('noShiftChip')}
        </span>
        {showPaused && (
          <span className='text-xs font-medium text-amber-600 dark:text-amber-400'>
            {t('paused')}
          </span>
        )}
      </Button>
      <ShiftPanel shift={shift} open={panelOpen} onOpenChange={setPanelOpen} />
    </>
  )
}
