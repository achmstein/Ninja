import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronUp, ReceiptText } from 'lucide-react'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { type LiveBills } from '@/lib/live-bills'
import { blurSwap } from '@/lib/motion'
import { PlaceIcon, placeKindOf } from '@/lib/places'
import { hasLiveBill, OpenBills } from '@/components/bills/open-bills'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Odometer } from './odometer'
import { DOCK_H } from './chrome'

/**
 * The bill running now, on the menu's dock: while the tray is empty the
 * dock's row is the bill (where, and what it comes to, rolling as rounds
 * land) and a tap opens it out of the dock as its sheet, its rounds
 * standing open, the way to pay under them. A dish going into the tray
 * takes the row back with a short blur, and the bill returns when the tray
 * is empty again. Nothing at all while no bill is open or forming.
 */
export function DockBill({ live, trayEmpty }: { live: LiveBills; trayEmpty: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const swap = blurSwap(useReducedMotion())
  const [open, setOpen] = useState(false)
  if (!hasLiveBill(live)) return null

  const first = live.open[0]?.bill ?? live.forming?.bill
  const total = live.open.reduce((sum, { bill }) => sum + Number(bill.total ?? 0), 0) + Number(live.forming?.bill.total ?? 0)
  const place = localized(first?.locationName) || t('atTheCounter')

  return (
    <>
      <AnimatePresence initial={false}>
        {trayEmpty && (
          <motion.button
            key='bill'
            type='button'
            onClick={() => setOpen(true)}
            aria-label={t('ninjaBillOpen')}
            {...swap}
            // Over the tray's own row, in the dock's colour, so the empty tray does not show under it
            className='bg-foreground text-background absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-[1.75rem] ps-6 pe-3 text-start'
            style={{ height: DOCK_H }}
          >
            <span className='bg-background/12 grid size-11 shrink-0 place-items-center rounded-full'>
              {first?.placeId != null ? <PlaceIcon kind={placeKindOf(first.placeKind)} className='size-5' /> : <ReceiptText className='size-5' />}
            </span>
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className='truncate text-xs opacity-70'>{place}</span>
              <Odometer value={price(total)} className='text-base font-bold' />
            </span>
            <span className='bg-background/12 flex h-10 shrink-0 items-center gap-1 rounded-full ps-4 pe-3 text-sm font-semibold'>
              {t('ninjaBillOpen')}
              <ChevronUp className='size-4' />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('ninjaBillOpen')}</SheetTitle>
          </SheetHeader>
          <OpenBills live={live} />
        </SheetContent>
      </Sheet>
    </>
  )
}
