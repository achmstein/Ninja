import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale, useT } from '@/lib/i18n'
import { OpenShiftDialog } from './open-shift-dialog'
import { useCurrentShift } from './use-current-shift'

/**
 * Header drawer-status chip: green with the shift's open time when a shift
 * is open (tap → the X report), amber "No shift" when none (tap → the
 * open-shift dialog). Quiet while the first answer is still loading.
 */
export function ShiftChip() {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)
  const { shift, noShift } = useCurrentShift({ refetchInterval: 60_000 })

  if (!shift && !noShift) return null

  if (shift) {
    const openedAt = shift.openedAt
      ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
          new Date(shift.openedAt)
        )
      : ''
    return (
      <Button
        variant='ghost'
        className='h-12 gap-2 rounded-full bg-emerald-500/10 px-4 text-emerald-700 hover:bg-emerald-500/20 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-400'
        aria-label={t('shiftTitle')}
        onClick={() => navigate({ to: '/shift' })}
      >
        <Banknote className='size-5' />
        <span className='text-sm font-medium tabular-nums'>{openedAt}</span>
      </Button>
    )
  }

  return (
    <>
      <Button
        variant='ghost'
        className='h-12 gap-2 rounded-full bg-amber-500/10 px-4 text-amber-700 hover:bg-amber-500/20 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-400'
        onClick={() => setDialogOpen(true)}
      >
        <Banknote className='size-5' />
        <span className='text-sm font-medium'>{t('noShiftChip')}</span>
      </Button>
      <OpenShiftDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
