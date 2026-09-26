import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ChevronDown, ReceiptText, Timer } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { FORMING_BILL, type PendingRound, type PendingStage } from '@/lib/live-bills'
import { type BillLineView, type BillView } from '@/api/sales'
import { billParts, isSettled, isTimeLine, isUnassigned, percent, runningTime, useNow } from '@/lib/bills'
import { spring, springSoft } from '@/lib/motion'
import { PlaceIcon, placeKindOf } from '@/lib/places'
import { useActiveStay, useMyStays } from '@/lib/stays'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RunningTimeLine } from '@/components/bills/bill-slip'
import { BillStars } from '@/components/bills/bill-rating'
import { Odometer } from '@/components/ninja/odometer'
import { Panel, Slab } from '@/components/ninja/page/parts'
import { BillPayBar } from '@/components/pay/bill-pay'

/** How far each round behind the front one peeks out under it, px */
const PEEK = 8
/** Rounds drawn behind the front one while the stack is closed */
const BEHIND = 2

type Round = {
  key: string
  /** When the round was sent, where the order is known (today's) */
  at: string | null
  lines: BillLineView[]
  /** The till put it on the bill without a name: there, but not read as theirs */
  unnamed: boolean
  /** Sent but not on the bill yet: the till has still to confirm it, or has and the bill is catching up */
  pending?: PendingStage
  orderId?: number
}


/**
 * A bill as a stack of its rounds. The total sits on top and rolls to each
 * new value like the tray's; a tap fans the stack open to every round and
 * what the till added to them, and folds it back. An open bill is the
 * dock's dark slab with the way to pay tucked under it; a closed one is a
 * light card, with the stars once it is paid.
 *
 * A round has one life: sent from the tray it is already on the front of
 * the stack, faint and marked as waiting; when the till confirms it and the
 * bill has it, the same card (the same key) turns solid and the total rolls
 * up. One the till turns down slides off. `takeover` is the bill that has
 * the tab to itself: its stack stands open.
 */
export function BillCard({
  bill,
  ordersById,
  pending = [],
  takeover = false,
}: {
  bill: BillView
  /** Today's orders by number: when each round was sent, and the stars on a paid bill */
  ordersById?: Map<number, OrderSummary>
  /** The customer's orders on their way to this bill, newest first */
  pending?: PendingRound[]
  takeover?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const stay = useActiveStay()
  const now = useNow()
  const { data: stays = [] } = useMyStays()
  const [fanned, setFanned] = useState(takeover)

  const settled = isSettled(bill)
  const voided = bill.status === 'Voided'
  const open = !settled && !voided

  const lines = bill.lines ?? []
  const time = lines.filter(isTimeLine)
  const onBill = roundsOf(
    lines.filter((line) => (line.isMine || isUnassigned(line)) && !isTimeLine(line)),
    ordersById,
    language
  )
  // The rounds still on their way lead the stack, keyed as they will be once on the bill
  const landed = new Set(onBill.map((r) => r.key))
  const onTheirWay = pending
    .filter((p) => !landed.has(`o${p.orderId}`))
    .map((p): Round => ({ key: `o${p.orderId}`, at: timeOf(p.date, language), lines: [], unnamed: false, pending: p.stage, orderId: p.orderId }))
  const rounds = [...onTheirWay, ...onBill]
  const forming = String(bill.id) === FORMING_BILL
  const running = runningTime(bill, stay, now)
  const sessionStay = bill.sessionId == null ? undefined : stays.find((s) => Number(s.id) === Number(bill.sessionId))
  const parts = billParts(bill, running, sessionStay)
  const discount = Number(bill.discount ?? 0)
  const service = Number(bill.serviceCharge ?? 0)
  const vat = Number(bill.vat ?? 0)
  const refunded = Number(bill.refundedTotal ?? 0)
  // With somebody else's rounds on it, the headline is the customer's own; the bill's total goes under
  const headline = parts.shared ? parts.ownLines : parts.total
  const hasTime = time.length > 0 || running != null
  const stackSize = rounds.length + (hasTime ? 1 : 0)
  // The room under the front card that the ones behind it peek into
  const peekRoom = Math.min(stackSize - 1, BEHIND) * PEEK

  const opened = bill.openedAt
    ? new Date(bill.openedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' })
    : ''
  const Surface = open ? Slab : Panel
  const row = 'flex items-baseline justify-between gap-2 tabular-nums'
  const small = cn(row, 'text-muted-foreground text-[13px]')

  return (
    <div className='flex flex-col'>
      <Surface layout className={cn('relative z-10 flex flex-col gap-4', !open && 'p-5')} transition={springSoft}>
        {/* Where and when, and what the till did with it */}
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-semibold'>
            {bill.placeId != null && <PlaceIcon kind={placeKindOf(bill.placeKind)} className='size-4 shrink-0' />}
            <span className='truncate'>{localized(bill.locationName) || t('atTheCounter')}</span>
            {opened && <span className='shrink-0'>· {opened}</span>}
          </span>
          {!forming && <StatusChip bill={bill} />}
        </div>

        <div className='flex items-end justify-between gap-3'>
          <div className={cn('flex min-w-0 flex-col', voided && 'line-through opacity-50')}>
            <span className='text-muted-foreground text-[13px]'>{parts.shared ? t('yourRounds') : t('total')}</span>
            <span className='text-[2rem] leading-tight font-extrabold'>
              {running && <span className='me-1 opacity-60'>≈</span>}
              <Odometer value={price(headline)} />
            </span>
          </div>
          {stackSize > 0 && (
            <button
              type='button'
              aria-expanded={fanned}
              onClick={() => setFanned((f) => !f)}
              className='bg-muted flex shrink-0 items-center gap-1 rounded-full py-1.5 ps-3 pe-2 text-[13px] font-semibold'
            >
              {rounds.length > 0 && t('ninjaRoundCount', { count: String(rounds.length) })}
              <motion.span animate={{ rotate: fanned ? 180 : 0 }} transition={spring} className='grid place-items-center'>
                <ChevronDown className='size-4' />
              </motion.span>
            </button>
          )}
        </div>

        {stackSize > 0 && (
          <LayoutGroup id={`bill-${bill.id}`}>
            <motion.div
              layout
              transition={springSoft}
              role='button'
              tabIndex={-1}
              onClick={() => setFanned((f) => !f)}
              className='relative flex cursor-pointer flex-col gap-2'
              style={{ paddingBottom: fanned ? 0 : peekRoom }}
            >
              <AnimatePresence initial={false}>
                {rounds.map((round, i) => (
                  <RoundCard key={round.key} round={round} index={i} fanned={fanned} dark={open} peekRoom={peekRoom} />
                ))}
              </AnimatePresence>
              {hasTime && (
                <StackCard index={rounds.length} fanned={fanned} dark={open} peekRoom={peekRoom}>
                  {time.map((line) => (
                    <LineRow key={String(line.id)} line={line} />
                  ))}
                  {running && <RunningTimeLine bill={bill} running={running} />}
                </StackCard>
              )}
            </motion.div>
          </LayoutGroup>
        )}

        {/* What the till added, and the whole bill's total when others are on it: with the stack open */}
        <AnimatePresence initial={false}>
          {fanned && (
            <motion.div
              key='extras'
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className='flex flex-col gap-1 overflow-hidden'
            >
              {!parts.shared && discount > 0 && (
                <div className={small}>
                  <span>
                    {t('discount')}
                    {bill.discountRate != null && ` ${percent(bill.discountRate)}%`}
                  </span>
                  <span>−{price(discount)}</span>
                </div>
              )}
              {!parts.shared && service > 0 && (
                <div className={small}>
                  <span>{t('serviceCharge', { rate: String(percent(bill.serviceChargeRate)) })}</span>
                  <span>{price(service)}</span>
                </div>
              )}
              {!parts.shared && vat > 0 && !bill.vatIncluded && (
                <div className={small}>
                  <span>{t('vat', { rate: String(percent(bill.vatRate)) })}</span>
                  <span>{price(vat)}</span>
                </div>
              )}
              {parts.shared && (
                <div className={small}>
                  <span>{t('billTotal')}</span>
                  <span>
                    {running && '≈ '}
                    {price(parts.total)}
                  </span>
                </div>
              )}
              {refunded > 0 && (
                <div className={cn(row, 'text-destructive text-[13px]')}>
                  <span>{t('refunded')}</span>
                  <span>−{price(refunded)}</span>
                </div>
              )}
              {!forming && (
                <Link
                  to='/receipts/$ticketId'
                  params={{ ticketId: String(bill.id) }}
                  className='bg-muted mt-2 flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold'
                >
                  <ReceiptText className='size-4' />
                  {t('ninjaOpenBill')}
                </Link>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Surface>

      {/* Paying from the phone, where the café takes it: tucked under the slab, as the order sheet tucks under the dock */}
      {open && !forming && (
        <div className='-mt-6 empty:hidden [&>*]:bg-muted [&>*]:rounded-t-none [&>*]:rounded-b-[1.5rem] [&>*]:pt-9'>
          <BillPayBar bill={bill} />
        </div>
      )}

      {/* A paid bill is the thanks: the stars for the rounds on it, at the one moment the customer is already looking */}
      {settled && ordersById && (
        <div className='px-2 pt-2 empty:hidden'>
          <BillStars bill={bill} ordersById={ordersById} />
        </div>
      )}
    </div>
  )
}

/** The customer's own lines (and the ones nobody's name is on) grouped by the order they came in, newest first. */
function roundsOf(lines: BillLineView[], ordersById: Map<number, OrderSummary> | undefined, language: string): Round[] {
  const byOrder = new Map<string, Round>()
  for (const line of lines) {
    const key = line.orderId != null ? `o${line.orderId}` : `l${line.id}`
    let round = byOrder.get(key)
    if (!round) {
      const date = line.orderId != null ? ordersById?.get(Number(line.orderId))?.date : null
      round = {
        key,
        at: timeOf(date, language),
        lines: [],
        unnamed: true,
      }
      byOrder.set(key, round)
    }
    round.lines.push(line)
    if (!isUnassigned(line)) round.unnamed = false
  }
  return [...byOrder.values()].reverse()
}

function timeOf(date: string | null | undefined, language: string): string | null {
  return date ? new Date(date).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : null
}

/**
 * One card of the stack. Closed, the front card shows in full and the next
 * ones sit behind it, each a step smaller and a step lower so their edges
 * peek out under it; open, they stand one under the other. Moving between
 * the two is one layout animation, so the stack fans rather than cuts.
 */
function StackCard({
  index,
  fanned,
  dark,
  peekRoom,
  pending = false,
  children,
}: {
  index: number
  fanned: boolean
  dark: boolean
  /** The room left under the front card, which the cards behind it are cut short by */
  peekRoom: number
  /** On its way to the bill: an outline, not yet a solid card */
  pending?: boolean
  children: React.ReactNode
}) {
  const behind = !fanned && index > 0
  const hidden = !fanned && index > BEHIND
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{
        opacity: hidden ? 0 : 1,
        y: behind ? index * PEEK : 0,
        scale: behind ? 1 - index * 0.05 : 1,
      }}
      // A round leaving the bill (turned down) slides off to the side
      exit={{ opacity: 0, x: 60, scale: 0.94, transition: { duration: 0.24, ease: [0.4, 0, 1, 1] } }}
      transition={springSoft}
      style={{ zIndex: 10 - index, originY: 1, bottom: behind ? peekRoom : undefined }}
      aria-hidden={behind || undefined}
      className={cn(
        'overflow-hidden rounded-[1.25rem] p-3 transition-[background-color,box-shadow] duration-300',
        pending
          ? 'bg-transparent shadow-[inset_0_0_0_1.5px_color-mix(in_oklab,currentColor_30%,transparent)]'
          : dark
            ? 'bg-[color-mix(in_oklab,var(--background)_9%,var(--foreground))]'
            : 'bg-muted',
        behind && 'absolute inset-x-0 top-0'
      )}
    >
      {/* Behind the front card only an edge shows; what is on it waits for the stack to open */}
      <motion.div layout='position' className='flex flex-col gap-1' animate={{ opacity: behind ? 0 : 1 }} transition={springSoft}>
        {children}
      </motion.div>
    </motion.div>
  )
}

function RoundCard({ round, ...card }: { round: Round; index: number; fanned: boolean; dark: boolean; peekRoom: number }) {
  const t = useT()
  // A round still on its way has no bill lines yet: its order says what is in it
  const detail = useQuery({
    ...getOrderOptions({ path: { orderId: round.orderId ?? 0 }, query: { 'api-version': API_VERSION } }),
    enabled: round.pending != null && round.orderId != null,
  })
  const lines: BillLineView[] = round.pending
    ? (detail.data?.orderItems ?? []).map((item, i) => ({
        id: `${round.key}-${i}`,
        description: item.productName,
        details: item.customizationsDescription,
        qty: item.units,
        total: Number(item.units ?? 0) * Number(item.unitPrice ?? 0),
      }))
    : round.lines
  return (
    <StackCard {...card} pending={round.pending != null}>
      <span className='flex items-center justify-between gap-2 empty:hidden'>
        {round.at && <span className='text-muted-foreground text-xs font-semibold'>{round.at}</span>}
        {round.pending && (
          <span className='ms-auto flex items-center gap-1.5 text-xs font-bold text-amber-500'>
            <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
            {t(round.pending === 'waiting' ? 'waitingToBeConfirmed' : 'addingToBill')}
          </span>
        )}
      </span>
      <div className={cn('flex flex-col gap-1 transition-opacity duration-300', (round.unnamed || round.pending) && 'opacity-60')}>
        {lines.map((line) => (
          <LineRow key={String(line.id)} line={line} />
        ))}
      </div>
    </StackCard>
  )
}

/** One line of a round, or the place's time, whole */
function LineRow({ line }: { line: BillLineView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const isTime = isTimeLine(line)
  const qty = Number(line.qty ?? 0)
  const details = localized(line.details)
  return (
    <div>
      <div className='flex items-baseline gap-1.5 text-sm'>
        {isTime ? (
          <Timer className='text-muted-foreground size-3.5 shrink-0 self-center' />
        ) : (
          <span className='text-muted-foreground font-semibold tabular-nums'>{qty}×</span>
        )}
        <span className='min-w-0 flex-1 font-medium'>{localized(line.description)}</span>
        <span className='shrink-0 tabular-nums'>{price(Number(line.total ?? 0))}</span>
      </div>
      {isTime ? (
        <p className='text-muted-foreground ms-5 text-xs tabular-nums'>
          {t('hoursShort', { count: String(qty) })} × {price(Number(line.unitPrice ?? 0))}
          {t('perHourShort')}
        </p>
      ) : (
        details && <p className='text-muted-foreground ms-5 text-xs'>{details}</p>
      )}
    </div>
  )
}

/** What the till did with the bill: paid (and on which receipt), on the customer's tab, voided, or still open. */
function StatusChip({ bill }: { bill: BillView }) {
  const t = useT()
  const base = 'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums'
  if (bill.status === 'Voided') return <span className={cn(base, 'bg-muted text-muted-foreground')}>{t('voided')}</span>
  if (!isSettled(bill)) {
    return (
      <span className={cn(base, 'flex items-center gap-1.5 bg-amber-400/15 text-amber-500')}>
        <span className='size-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none' />
        {t('unpaid')}
      </span>
    )
  }
  return (
    <span className={cn(base, 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400')}>
      {bill.paidWith === 'Account' ? t('onYourTab') : t('paid')}
      {bill.receiptNumber != null && ` ${t('receiptShort', { number: Number(bill.receiptNumber) })}`}
    </span>
  )
}
