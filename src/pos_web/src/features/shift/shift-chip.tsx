import { useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranchFlags } from '@/features/branch/use-branch-flags'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'
import { OpenShiftDialog } from './open-shift-dialog'
import { useCurrentShift } from './use-current-shift'

/**
 * Header status chip: one plain outline button that reads the day — a
 * status dot plus the shift's open time, muted "No shift" when none, and an
 * amber "Paused" when the store has stopped taking orders or reservations
 * mid-shift. Tap → straight to the shift screen (its X report, drawer
 * movements, the pause switches and the close), or the open-shift dialog
 * when none is open. Quiet while the first answer is still loading. The
 * dot does the signalling so the chip keeps the same surface, border and
 * foreground as every other control in the chrome.
 */
export function ShiftChip() {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const [openShiftOpen, setOpenShiftOpen] = useState(false)
  const { shift: liveShift, noShift: liveNoShift } = useCurrentShift({
    refetchInterval: 60_000,
  })
  const { paused } = useBranchFlags()

  // Keep showing the last definite answer through any transient gap — a tab
  // regaining focus refetches (and may briefly re-auth), a branch switch
  // resets every query — so the chip never blinks out once it has loaded.
  const lastRef = useRef<{ shift: typeof liveShift; noShift: boolean } | null>(
    null
  )
  const settled = liveShift != null || liveNoShift
  if (settled) lastRef.current = { shift: liveShift, noShift: liveNoShift }
  const view = settled
    ? { shift: liveShift, noShift: liveNoShift }
    : lastRef.current

  // Only the very first load, before any answer has ever arrived, holds the
  // place with a neutral placeholder.
  if (!view) {
    return (
      <Button variant='outline' className='h-12 gap-2 px-4' disabled>
        <span aria-hidden className='bg-muted-foreground/40 size-2 rounded-full' />
        <Skeleton className='h-4 w-20' />
      </Button>
    )
  }
  const shift = view.shift

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
        onClick={() =>
          shift ? navigate({ to: '/shift' }) : setOpenShiftOpen(true)
        }
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
      <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
    </>
  )
}
