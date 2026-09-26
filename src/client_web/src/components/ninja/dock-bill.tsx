import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BellRing, Check, ChefHat, ChevronUp, ReceiptText, Send, X } from 'lucide-react'
import { useArabicStyle, useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { useLiveOrder } from '@/lib/live-order'
import { STAGE_LABEL, words, type PillStage } from '@/lib/order-pill'
import { cn } from '@/lib/utils'
import { type LiveBills } from '@/lib/live-bills'
import { blurSwap } from '@/lib/motion'
import { PlaceIcon, placeKindOf } from '@/lib/places'
import { hasLiveBill, OpenBills } from '@/components/bills/open-bills'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Odometer } from './odometer'
import { DOCK_H } from './chrome'

const STAGE_ICONS: Record<PillStage, typeof Send> = { sent: Send, preparing: ChefHat, ready: BellRing, paid: Check, cancelled: X }

/**
 * The bill running now and the order on its way, on the dock: the row says
 * where the order has got to (Sent, Preparing, Ready) above what the bill
 * comes to, rolling as rounds land, each change swapping in with a short
 * blur. A tap opens the bill out of the dock as its sheet, its rounds
 * standing open, the way to pay under them. On the menu a dish going into
 * the tray takes the row back, and it returns when the tray is empty again;
 * on the other tabs it sits above the tabs. Nothing at all while there is
 * no bill and no order.
 */
export function DockBill({ live, trayEmpty, className }: { live: LiveBills; trayEmpty: boolean; className?: string }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const standard = useArabicStyle((s) => s.standard)
  const swap = blurSwap(useReducedMotion())
  const [open, setOpen] = useState(false)
  const { stage, orderNumber } = useLiveOrder()
  if (!hasLiveBill(live) && stage == null) return null

  const first = live.open[0]?.bill ?? live.forming?.bill
  const total = live.open.reduce((sum, { bill }) => sum + Number(bill.total ?? 0), 0) + Number(live.forming?.bill.total ?? 0)
  const place = localized(first?.locationName) || t('atTheCounter')
  // The order on its way says where it is in the row's top line; otherwise the line is the place
  const line = stage ? `${words(STAGE_LABEL[stage], language, standard)}${orderNumber != null ? ` · #${orderNumber}` : ''}` : place
  const StageIcon = stage ? STAGE_ICONS[stage] : null

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
            className={cn(
              'bg-foreground text-background absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-[1.75rem] ps-6 pe-3 text-start',
              className
            )}
            style={{ height: DOCK_H }}
          >
            {/* The order's stage when one is on its way (its colour saying how it is going), else the place */}
            <span
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300',
                stage === 'ready' || stage === 'paid' ? 'bg-emerald-500 text-white' : stage === 'cancelled' ? 'bg-red-500 text-white' : 'bg-background/12'
              )}
            >
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.span key={stage ?? 'place'} {...swap} className='grid place-items-center'>
                  {StageIcon ? (
                    <StageIcon className={cn('size-5', (stage === 'sent' || stage === 'preparing') && 'animate-pulse motion-reduce:animate-none')} />
                  ) : first?.placeId != null ? (
                    <PlaceIcon kind={placeKindOf(first.placeKind)} className='size-5' />
                  ) : (
                    <ReceiptText className='size-5' />
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
            <span className='flex min-w-0 flex-1 flex-col'>
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.span key={line} {...swap} className='truncate text-xs opacity-70'>
                  {line}
                </motion.span>
              </AnimatePresence>
              {total > 0 ? <Odometer value={price(total)} className='text-base font-bold' /> : <span className='truncate text-base font-bold'>{place}</span>}
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
