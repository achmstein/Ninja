import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import type { ShiftView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { useBranchFlags } from '@/features/branch/use-branch-flags'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CloseShiftDialog } from './close-shift-dialog'
import { OpenShiftDialog } from './open-shift-dialog'

type FlagRowProps = {
  label: string
  on: boolean
  disabled: boolean
  onChange: (on: boolean) => void
  className?: string
}

function FlagRow({ label, on, disabled, onChange, className }: FlagRowProps) {
  const t = useT()
  return (
    <label
      className={cn(
        'flex min-h-14 cursor-pointer items-center justify-between gap-4 px-4 py-2',
        className
      )}
    >
      <span className='flex items-center gap-2 text-base font-medium'>
        <span
          aria-hidden
          className={cn(
            'size-2 rounded-full',
            on ? 'bg-emerald-500' : 'bg-amber-500'
          )}
        />
        {label}
        {!on && (
          <span className='text-muted-foreground text-xs font-normal'>
            {t('paused')}
          </span>
        )}
      </span>
      <Switch checked={on} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

type ShiftPanelProps = {
  shift: ShiftView | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Everything that says whether the store is trading, behind the one header
 * chip: the drawer shift (open or close it, or go to its X report) and the
 * two customer-facing switches — taking orders, taking reservations — for a
 * mid-day pause. The shift flips both switches on its own (open → on,
 * close → off); the switches are for in between.
 */
export function ShiftPanel({ shift, open, onOpenChange }: ShiftPanelProps) {
  const t = useT()
  const locale = useLocale()
  const navigate = useNavigate()
  const [openShiftOpen, setOpenShiftOpen] = useState(false)
  const [closeShiftOpen, setCloseShiftOpen] = useState(false)
  const flags = useBranchFlags()

  const openedAt = shift?.openedAt
    ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
        new Date(shift.openedAt)
      )
    : ''

  // The panel steps aside for the dialog it hands off to
  const handOff = (setNext: (open: boolean) => void) => {
    onOpenChange(false)
    setNext(true)
  }

  const switchesDisabled = !flags.branch || flags.isPending

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='gap-5 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='text-xl'>{t('shiftTitle')}</DialogTitle>
            <DialogDescription className='text-base'>
              {shift ? `${t('openedAt')} ${openedAt}` : t('noShiftOpen')}
            </DialogDescription>
          </DialogHeader>

          <div>
            <div className='rounded-lg border'>
              <FlagRow
                label={t('takingOrders')}
                on={flags.takingOrders}
                disabled={switchesDisabled}
                onChange={flags.setTakingOrders}
              />
              <FlagRow
                label={t('takingReservations')}
                on={flags.takingReservations}
                disabled={switchesDisabled}
                onChange={flags.setTakingReservations}
                className='border-t'
              />
            </div>
            <p className='text-muted-foreground mt-2 text-sm'>
              {t('takingAutoHint')}
            </p>
          </div>

          <DialogFooter className='gap-2'>
            {shift ? (
              <>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  onClick={() => {
                    onOpenChange(false)
                    navigate({ to: '/shift' })
                  }}
                >
                  {t('shiftDetails')}
                </Button>
                <Button
                  variant='destructive'
                  size='lg'
                  className='h-12'
                  onClick={() => handOff(setCloseShiftOpen)}
                >
                  {t('closeShiftAction')}
                </Button>
              </>
            ) : (
              <Button
                size='lg'
                className='h-12'
                onClick={() => handOff(setOpenShiftOpen)}
              >
                {t('openShiftAction')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {shift ? (
        <CloseShiftDialog
          shift={shift}
          open={closeShiftOpen}
          onOpenChange={setCloseShiftOpen}
        />
      ) : (
        <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
      )}
    </>
  )
}
