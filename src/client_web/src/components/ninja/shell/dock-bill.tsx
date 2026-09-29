import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronUp, CircleHelp, ReceiptText, Send, X } from 'lucide-react'
import { useArabicStyle, useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { useLiveOrder } from '@/lib/live-order'
import { STAGE_LABEL, words, type PillStage } from '@/lib/order-pill'
import { cn } from '@/lib/utils'
import { type LiveBills } from '@/lib/live-bills'
import { blurSwap } from '@/lib/motion'
import { PlaceIcon, placeKindOf } from '@/lib/places'
import { useServiceRequests } from '@/lib/service-requests'
import { SERVICE_REQUEST } from '@/lib/services/notifications'
import { useActivePlace, useActivePlaceConfirmed } from '@/stores/place-store'
import { TableView } from '@/components/places/table-view'
import { RoomView } from '@/components/places/room-view'
import { formatClock, useSecondTick } from '@/lib/clock'
import { useDockSheet } from '@/lib/dock-sheet'
import { useActiveStay } from '@/lib/stays'
import { hasLiveBill, OpenBills } from '@/components/bills/open-bills'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Odometer } from '../odometer'
import { DOCK_H } from './chrome'
import { useDockRowShown } from './use-dock-row'

/** What a dot on the row stands for: something asked for and not yet done with */
const ASKED = [SERVICE_REQUEST.callWaiter, SERVICE_REQUEST.receiptToPay, SERVICE_REQUEST.controllerChange, SERVICE_REQUEST.changeOption]

const STAGE_ICONS: Record<PillStage, typeof Send> = { sent: Send, confirmed: Check, paid: ReceiptText, cancelled: X }

/**
 * The bill running now and the order on its way, on the dock: the row says
 * where the order has got to (Sent, Confirmed) above what the bill
 * comes to, rolling as rounds land, each change swapping in with a short
 * blur. A tap opens the bill out of the dock as its sheet, its rounds
 * standing open, the way to pay under them. On the menu a dish going into
 * the tray takes the row back, and it returns when the tray is empty again;
 * on the other tabs it sits above the tabs. At a table, or in a room with
 * the clock running, the row is that place too: its name (the top bar keeps
 * only the brand), a dot while something is asked for, and a tap opens what
 * can be asked for there (the waiter, the bill, a controller, the rate)
 * with the bills under it. A room is a table with a clock: the same row
 * with its time ticking, the same tiles, and the clock as the sheet's hero.
 * The sheet is one for the app (lib/dock-sheet.ts): the Book tab's "you're
 * in" card opens it too. Nothing at all while there is no bill, no order and no
 * place.
 */
export function DockBill({ live, trayEmpty, className }: { live: LiveBills; trayEmpty: boolean; className?: string }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const standard = useArabicStyle((s) => s.standard)
  const swap = blurSwap(useReducedMotion())
  const open = useDockSheet((s) => s.open)
  const setOpen = useDockSheet((s) => s.setOpen)
  const { stage, orderNumber } = useLiveOrder()
  const stay = useActiveStay()
  // A running room is where the customer is, over a table scanned before it
  const scanned = useActivePlace()
  const table = stay ? null : scanned
  const confirmed = useActivePlaceConfirmed()
  // A dot on the table while the waiter or the bill is asked for, so the answer is one tap away
  const requests = useServiceRequests(
    stay
      ? { placeId: Number(stay.placeId), placeKind: Number(stay.placeKind), placeName: stay.placeName ?? {}, sessionId: Number(stay.id) }
      : { placeId: table?.id ?? 0, placeKind: table?.kind ?? 0, placeName: table?.name ?? {} }
  )
  const asking =
    (table != null || stay != null) &&
    ASKED.some((type) => requests.stateOf(type).phase !== 'idle')
  const shown = useDockRowShown(live)
  // The room's clock ticks in the row, so the tab it lived on can go back to booking
  const now = useSecondTick(stay?.startedAt != null)
  if (!shown) return null

  const first = live.open[0]?.bill ?? live.forming?.bill
  const total = live.open.reduce((sum, { bill }) => sum + Number(bill.total ?? 0), 0) + Number(live.forming?.bill.total ?? 0)
  const place = (stay ? localized(stay.placeName) : table ? localized(table.name) : localized(first?.locationName)) || t('atTheCounter')
  // The order on its way says where it is in the row's top line; otherwise the line is where the customer is
  // With nothing on the bill yet the place is the row's one line
  const clock = stay?.startedAt ? formatClock((now - new Date(stay.startedAt).getTime()) / 1000) : null
  const line = stage
    ? `${words(STAGE_LABEL[stage], language, standard)}${orderNumber != null ? ` · #${orderNumber}` : ''}`
    : total > 0 || clock
      ? place
      : null
  const StageIcon = stage ? STAGE_ICONS[stage] : null
  const placeKind = stay ? Number(stay.placeKind) : table ? table.kind : first?.placeId != null ? placeKindOf(first.placeKind) : null
  const label = t(stay ? 'ninjaRoomOpen' : table ? 'ninjaTableOpen' : 'ninjaBillOpen')

  return (
    <>
      <AnimatePresence initial={false}>
        {trayEmpty && (
          <motion.button
            key='bill'
            type='button'
            onClick={() => setOpen(true)}
            aria-label={label}
            {...swap}
            // Over the tray's own row, in the dock's colour, so the empty tray does not show under it
            className={cn(
              'slab absolute inset-x-0 top-0 z-10 flex items-center gap-3 rounded-t-[1.75rem] ps-6 pe-3 text-start',
              className
            )}
            style={{ height: DOCK_H }}
          >
            {/* The dock's grab handle, as on the tray's row: every row of the dock has it */}
            <span aria-hidden className='bg-background/30 absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full' />
            {/* The order's stage when one is on its way (its colour saying how it is going), else the place */}
            <span
              className={cn(
                'relative grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300',
                stage === 'confirmed' || stage === 'paid' ? 'bg-emerald-500 text-white' : stage === 'cancelled' ? 'bg-red-500 text-white' : 'bg-background/12'
              )}
            >
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.span key={stage ?? 'place'} {...swap} className='grid place-items-center'>
                  {StageIcon ? (
                    <StageIcon className={cn('size-5', stage === 'sent' && 'animate-pulse motion-reduce:animate-none')} />
                  ) : table && !confirmed ? (
                    // A table from an earlier session shows as a question until answered
                    <CircleHelp className='size-5' />
                  ) : placeKind != null ? (
                    <PlaceIcon kind={placeKind} className='size-5' />
                  ) : (
                    <ReceiptText className='size-5' />
                  )}
                </motion.span>
              </AnimatePresence>
              {asking && <span className='ring-foreground absolute end-0 top-0 size-2.5 rounded-full bg-amber-400 ring-2' />}
            </span>
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className='flex min-w-0 items-center gap-1 text-caption'>
                <AnimatePresence mode='popLayout' initial={false}>
                  {line && (
                    <motion.span key={line} {...swap} className='truncate opacity-70'>
                      {line}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* With a bill to show, the room's time rides along the top line */}
                {/* The dot stands on its own so it sits between the name and the time in either direction;
                    inside the time's ltr span it ended up after the time in Arabic */}
                {clock && total > 0 && !stage && (
                  <>
                    <span aria-hidden className='shrink-0 opacity-70'>·</span>
                    <span dir='ltr' className='shrink-0 opacity-70'>
                      <Odometer value={clock} />
                    </span>
                  </>
                )}
              </span>
              {total > 0 ? (
                <Odometer value={price(total)} className='text-name font-bold' />
              ) : clock ? (
                <span dir='ltr' className='self-start text-name font-bold rtl:self-end'>
                  <Odometer value={clock} />
                </span>
              ) : (
                <span className='truncate text-name font-bold'>{place}</span>
              )}
            </span>
            <span className='bg-background/12 flex h-10 shrink-0 items-center gap-1 rounded-full ps-4 pe-3 text-note font-semibold'>
              {label}
              <ChevronUp className='size-4' />
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={open} onOpenChange={setOpen}>
        {stay ? (
          // The room: its clock, what to ask for, its bills, the way out
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{localized(stay.placeName)}</SheetTitle>
            </SheetHeader>
            <RoomView stay={stay} live={live} onLeft={() => setOpen(false)} />
          </SheetContent>
        ) : table ? (
          // The table first (the waiter, the bill, the way out), then its bills
          <SheetContent className='gap-0 p-0'>
            <SheetTitle className='sr-only'>{localized(table.name)}</SheetTitle>
            <div className='max-h-[85svh] overflow-y-auto'>
              <TableView place={table} onClose={() => setOpen(false)} />
              {hasLiveBill(live) && (
                <div className='px-4 pb-6'>
                  <OpenBills live={live} />
                </div>
              )}
            </div>
          </SheetContent>
        ) : (
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{t('ninjaBillOpen')}</SheetTitle>
            </SheetHeader>
            <OpenBills live={live} />
          </SheetContent>
        )}
      </Sheet>
    </>
  )
}

