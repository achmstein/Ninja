import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'
import { OpenShiftDialog } from './open-shift-dialog'
import { useCurrentShift } from './use-current-shift'

/**
 * Header drawer-status chip: a plain outline button carrying a status dot —
 * lit with the shift's open time (tap → the X report), muted "No shift"
 * when none (tap → the open-shift dialog). Quiet while the first answer is
 * still loading. The dot does the signalling so the chip keeps the same
 * surface, border and foreground as every other control in the chrome.
 */
export function ShiftChip() {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const { shift, noShift } = useCurrentShift({ refetchInterval: 60_000 })

  if (!shift && !noShift) return null

  const openedAt = shift?.openedAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
        new Date(shift.openedAt)
      )
    : ''

  return (
    <>
      <Button
        variant='outline'
        className='h-12 gap-2 px-4'
        onClick={() =>
          shift ? navigate({ to: '/shift' }) : setDialogOpen(true)
        }
      >
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            shift ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          )}
        />
        <span className='text-sm font-medium tabular-nums'>
          {shift ? `${t('shiftTitle')} ${openedAt}` : t('noShiftChip')}
        </span>
      </Button>
      {!shift && (
        <OpenShiftDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </>
  )
}
