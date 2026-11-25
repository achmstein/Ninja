import { useState } from 'react'
import { Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TradingSwitches } from '@/features/shift/trading-switches'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useBranchFlags } from './use-branch-flags'

/**
 * Header button for the branch's two customer-facing switches: taking
 * orders, taking reservations. It says where the branch stands (a green dot
 * while customers can do both, amber and which one is stopped otherwise) and
 * opens the switches in a dialog, so a pause in the middle of a rush is two
 * taps from any screen instead of a trip into the shift's details. The shift
 * still flips both by itself: on when it opens, off when it closes.
 */
export function TradingChip() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const flags = useBranchFlags()
  const reservations = flags.reservations

  // Nothing to say until the branch is known
  if (!flags.branch) return null

  const ordersOff = !flags.takingOrders
  const reservationsOff = reservations && !flags.takingReservations
  const label =
    ordersOff && reservationsOff
      ? t('paused')
      : ordersOff
        ? t('ordersPaused')
        : reservationsOff
          ? t('reservationsPaused')
          : t('openToCustomers')

  return (
    <>
      {/* A phone's header has room for the icon and its dot alone; the words
          stay for the screen reader */}
      <Button
        variant='outline'
        className='h-12 gap-2 px-4 max-sm:w-12 max-sm:px-0'
        title={label}
        onClick={() => setOpen(true)}
      >
        <span className='relative'>
          <Store className='size-5' />
          <span
            aria-hidden
            className={cn(
              'ring-background absolute -end-1 -top-1 size-2.5 rounded-full ring-2',
              flags.paused ? 'bg-amber-500' : 'bg-emerald-500'
            )}
          />
        </span>
        <span
          className={cn(
            'text-sm font-medium max-lg:sr-only',
            flags.paused && 'text-amber-600 dark:text-amber-400'
          )}
        >
          {label}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='gap-4 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-xl'>
              <Store className='size-5' />
              {reservations ? t('ordersAndReservations') : t('customerOrders')}
            </DialogTitle>
            <DialogDescription className='text-base'>
              {t('tradingHint')}
            </DialogDescription>
          </DialogHeader>
          <TradingSwitches />
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => setOpen(false)}
          >
            {t('done')}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
