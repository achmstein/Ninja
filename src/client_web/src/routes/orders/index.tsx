import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  ChevronRight,
  CircleAlert,
  Loader2,
  ReceiptText,
  Star,
  Timer,
} from 'lucide-react'
import { rateOrder, type Order, type OrderSummary } from '@/api/ordering'
import {
  getOrderOptions,
  getOrdersByUserOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { type BillLineView, type BillView } from '@/api/sales'
import { getMyBillsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { type StayViewModel } from '@/api/spaces'
import { API_VERSION } from '@/lib/api-client'
import { statusDotClass } from '@/lib/order-status'
import { PLACE_ROOM, PLACE_STATION, PLACE_TABLE, PlaceIcon } from '@/lib/places'
import { useActiveStay } from '@/lib/stays'
import { businessDayStart } from '@/lib/business-day'
import { dayStartHour, isOvernightShift, useSelectedBranch } from '@/lib/branch'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SignInOptions } from '@/components/sign-in-options'
import { useGuestStore } from '@/stores/guest-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const Route = createFileRoute('/orders/')({
  component: OrdersRoute,
})

/**
 * Open to guests: Sales and Ordering both know a guest by the id this
 * browser sends. Only a visitor who has neither an account nor a guest id
 * has nothing to show, and they get the sign-in prompt.
 */
function OrdersRoute() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)

  if (!auth.isAuthenticated && !auth.isLoading && !guestId) {
    return <SignedOutPrompt />
  }

  return <OrdersPage />
}

function SignedOutPrompt() {
  const t = useT()
  return (
    <div className='flex h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center'>
      <ReceiptText className='text-muted-foreground/40 h-12 w-12' />
      <p className='text-muted-foreground'>{t('noGuestOrdersYet')}</p>
      <SignInOptions />
    </div>
  )
}

/** How far back the history tab reaches. One read, no paging: a regular's
 *  three months of bills is a short list. */
const HISTORY_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

/** Ordering and Sales spell the kind by name ("Table"); the icons go by number. */
function placeKindOf(kind: string | null | undefined): number {
  return kind === 'Table'
    ? PLACE_TABLE
    : kind === 'Station'
      ? PLACE_STATION
      : PLACE_ROOM
}

const isOpen = (bill: BillView) => bill.status === 'Open'
const isSettled = (bill: BillView) => bill.status === 'Settled'

/** When the till closed the bill, paid or thrown out; null while open. */
function closedAt(bill: BillView): Date | null {
  const at = bill.settledAt ?? bill.voidedAt
  return at ? new Date(at) : null
}

/**
 * The page is the customer's bills, not their orders (docs/visit-tab.html):
 * everything the cafe charges — the rounds, a room's time, a discount,
 * service and VAT — lands on a Sales ticket, and the till's own arithmetic
 * is what the customer sees. One tile per bill they are on today, open ones
 * first with what they add up to over them; an order the till has not
 * confirmed yet waits above, since it is on no bill until then.
 */
function OrdersPage() {
  const t = useT()
  const branch = useSelectedBranch()

  // Today = the branch's current business day (overnight shifts included).
  // The bills read reaches back for the history tab in the same call; open
  // bills come whatever their age, so last night's unpaid table is today's.
  const dayStart = businessDayStart(branch)
  const since = new Date(dayStart.getTime() - HISTORY_DAYS * DAY_MS)
  const billsQuery = useQuery({
    ...getMyBillsOptions({
      query: { 'api-version': API_VERSION, since: since.toISOString() },
    }),
    // A friend's round landing on the same bill sends this browser no
    // event, so an open bill is re-read now and then as well
    refetchInterval: (query) =>
      query.state.data?.some(isOpen) ? 30_000 : false,
  })
  const bills = billsQuery.data ?? []
  const todayBills = bills.filter((bill) => {
    const closed = closedAt(bill)
    return closed == null || closed >= dayStart
  })
  const pastBills = bills.filter((bill) => {
    const closed = closedAt(bill)
    return closed != null && closed < dayStart
  })

  // The orders themselves are still read for what is not on a bill yet —
  // sent and waiting, or turned down — and for the rating on each
  const ordersQuery = useQuery(
    getOrdersByUserOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: 0,
        pageSize: 50,
        fromDate: dayStart.toISOString(),
      },
    })
  )
  const todayOrders = ordersQuery.data?.items ?? []
  const waiting = todayOrders.filter((order) => {
    const status = order.status?.toLowerCase()
    return status !== 'confirmed' && status !== 'cancelled'
  })
  const cancelled = todayOrders.filter(
    (order) => order.status?.toLowerCase() === 'cancelled'
  )
  const ordersById = new Map(
    todayOrders.map((order) => [Number(order.orderNumber), order])
  )

  const loading = billsQuery.isLoading || ordersQuery.isLoading
  const retry = () => {
    void billsQuery.refetch()
    void ordersQuery.refetch()
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('orders')}</h1>

      <Tabs defaultValue='today'>
        <TabsList className='w-full'>
          <TabsTrigger value='today' className='flex-1'>
            {t('todaysOrders')}
          </TabsTrigger>
          <TabsTrigger value='history' className='flex-1'>
            {t('previousOrders')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='today' className='mt-2'>
          {loading ? (
            <BillsSkeleton />
          ) : billsQuery.isError && ordersQuery.isError ? (
            <ErrorState onRetry={retry} />
          ) : todayBills.length === 0 &&
            waiting.length === 0 &&
            cancelled.length === 0 ? (
            <EmptyState title={t('nothingOnYouToday')} />
          ) : (
            <div className='flex flex-col'>
              <OnYouToday bills={todayBills} />
              <OrderGroup title={t('waitingToBeConfirmed')} orders={waiting} />
              <OrderGroup title={t('statusCancelled')} orders={cancelled} />
              <div className='divide-y'>
                {todayBills.map((bill) => (
                  <BillTile
                    key={String(bill.id)}
                    bill={bill}
                    ordersById={ordersById}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value='history' className='mt-2'>
          {billsQuery.isLoading ? (
            <BillsSkeleton />
          ) : billsQuery.isError ? (
            <ErrorState onRetry={retry} />
          ) : pastBills.length === 0 ? (
            <EmptyState title={t('noOrdersYet')} />
          ) : (
            <HistoryList bills={pastBills} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * What the open bills add up to, over them. A running clock is not on its
 * bill until it stops, so its time so far is added here the way the till
 * will add it, and the sum is marked as about.
 */
function OnYouToday({ bills }: { bills: BillView[] }) {
  const t = useT()
  const price = usePrice()
  const stay = useActiveStay()
  const now = useNow()

  const open = bills.filter(isOpen)
  if (open.length === 0) return null

  const running = open.map((bill) => runningTime(bill, stay, now))
  const approx = running.some((time) => time != null)
  const sum = open.reduce(
    (total, bill, i) =>
      total + Number(bill.total ?? 0) + (running[i]?.charged ?? 0),
    0
  )

  return (
    <div className='flex items-baseline justify-between py-2'>
      <span className='text-muted-foreground text-[13px]'>
        {t('onYouToday')}
      </span>
      <span className='text-lg font-bold tabular-nums'>
        {approx && '≈ '}
        {price(sum)}
      </span>
    </div>
  )
}

/** A minute clock: the running time line only needs the minute. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

type RunningTime = {
  /** Minutes on the clock so far */
  minutes: number
  /** One entry per rate the clock ran on, as the till will bill them */
  parts: Array<{
    optionName: StayViewModel['currentOptionName']
    hours: number
    rate: number
    cost: number
  }>
  /** The cost with the bill's discount, service and VAT on top, since
   *  that is what the total will grow by */
  charged: number
}

/**
 * The time a running clock has racked up on an open bill, before the till
 * stops it and it lands as a line. Mirrors Stay.HoursFor: the minutes on
 * each rate, rounded to the tariff's step, times that rate. Only for the
 * stay this customer is in — anyone else's clock is not theirs to see.
 */
function runningTime(
  bill: BillView,
  stay: StayViewModel | undefined,
  now: number
): RunningTime | null {
  if (
    !isOpen(bill) ||
    bill.sessionId == null ||
    bill.sessionEndedAt != null ||
    stay == null ||
    Number(stay.id) !== Number(bill.sessionId) ||
    !stay.startedAt
  )
    return null

  const step = Number(stay.tariff?.roundingMinutes ?? 15) || 15
  const byOption = new Map<
    string,
    {
      optionName: StayViewModel['currentOptionName']
      rate: number
      minutes: number
    }
  >()
  for (const segment of stay.segments ?? []) {
    if (!segment.startTime) continue
    const end = segment.endTime ? new Date(segment.endTime).getTime() : now
    const minutes = Math.max(
      0,
      (end - new Date(segment.startTime).getTime()) / 60_000
    )
    const code = segment.optionCode ?? ''
    const part = byOption.get(code) ?? {
      optionName: segment.optionName,
      rate: Number(segment.hourlyRate ?? 0),
      minutes: 0,
    }
    part.minutes += minutes
    byOption.set(code, part)
  }

  const parts = [...byOption.values()].map((part) => {
    const hours = (Math.round(part.minutes / step) * step) / 60
    return {
      optionName: part.optionName,
      hours,
      rate: part.rate,
      cost: hours * part.rate,
    }
  })
  const minutes = Math.max(
    0,
    (now - new Date(stay.startedAt).getTime()) / 60_000
  )
  const cost = parts.reduce((sum, part) => sum + part.cost, 0)

  // The same order the till applies them in: discount, then service, then
  // VAT unless the prices already include it
  let charged = cost * (1 - Number(bill.discountRate ?? 0))
  charged += charged * Number(bill.serviceChargeRate ?? 0)
  if (!bill.vatIncluded) charged += charged * Number(bill.vatRate ?? 0)

  return { minutes, parts, charged }
}

/** Mirrors a bill tile: the header line, a few lines, the total. */
function BillsSkeleton() {
  return (
    <div className='flex flex-col pt-2'>
      {[...Array(3)].map((_, i) => (
        <div key={i} className='flex flex-col gap-2 py-3'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-2.5 shrink-0 rounded-full' />
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-3 w-20' />
            <Skeleton className='ms-auto h-5 w-14 shrink-0 rounded-full' />
          </div>
          <Skeleton className='ms-[18px] h-3 w-3/5' />
          <Skeleton className='ms-[18px] h-3 w-2/5' />
          <Skeleton className='ms-[18px] h-4 w-full' />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className='flex h-[40svh] flex-col items-center justify-center gap-2 text-center'>
      <ReceiptText className='text-muted-foreground h-16 w-16' />
      <p className='text-lg'>{title}</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  return (
    <div className='flex h-[40svh] flex-col items-center justify-center gap-3 text-center'>
      <CircleAlert className='text-muted-foreground h-12 w-12' />
      <p>{t('failedToLoadOrders')}</p>
      <Button variant='outline' className='rounded-full' onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}

// ── History: bills grouped by business day (shift-aware, mobile parity) ──

function HistoryList({ bills }: { bills: BillView[] }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branch = useSelectedBranch()

  // For overnight shifts, a bill closed before the start hour belongs to
  // the previous day's shift (same rule as the mobile app)
  const startHour = dayStartHour(branch)
  const overnight = isOvernightShift(branch)
  const shiftDay = (date: Date): Date => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (overnight && date.getHours() < startHour) day.setDate(day.getDate() - 1)
    return day
  }
  const todayShift = shiftDay(new Date())
  const yesterdayShift = new Date(todayShift)
  yesterdayShift.setDate(yesterdayShift.getDate() - 1)

  const labelFor = (day: Date): string => {
    if (day.getTime() === todayShift.getTime()) return t('today')
    if (day.getTime() === yesterdayShift.getTime()) return t('yesterday')
    return day.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  const groups: Array<{ label: string; bills: BillView[] }> = []
  for (const bill of bills) {
    const closed = closedAt(bill)
    const label = closed ? labelFor(shiftDay(closed)) : ''
    const group = groups.at(-1)
    if (group && group.label === label) {
      group.bills.push(bill)
    } else {
      groups.push({ label, bills: [bill] })
    }
  }

  return (
    <div className='flex flex-col'>
      {groups.map((group) => (
        <div key={group.label} className='flex flex-col'>
          <h3 className='text-muted-foreground pt-4 pb-1 text-[13px] font-semibold'>
            {group.label}
          </h3>
          <div className='divide-y'>
            {group.bills.map((bill) => (
              <BillTile key={String(bill.id)} bill={bill} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Bill tile: the till's bill, laid out like a slip ──

/** Open is money outstanding, paid is done, voided is thrown out. */
function billDotClass(bill: BillView): string {
  return isSettled(bill)
    ? 'bg-green-600 dark:bg-green-500'
    : bill.status === 'Voided'
      ? 'bg-destructive'
      : 'bg-orange-500'
}

function BillTile({
  bill,
  ordersById,
}: {
  bill: BillView
  /** Today's orders by number, for the stars on a paid bill; the history
   *  tab has none */
  ordersById?: Map<number, OrderSummary>
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const stay = useActiveStay()
  const now = useNow()
  const [open, setOpen] = useState(false)

  // The tile is the customer's own view of the bill: their rounds, the
  // room's time (the bill's, not anyone's), and the total. Everyone
  // else's rounds, the discount, service and VAT fold into one "rest of
  // the bill" row so the numbers still add up; the slip behind the tap
  // itemises all of it.
  const lines = bill.lines ?? []
  const mine = lines.filter(
    (line) => line.isMine && line.source !== 'SessionTime'
  )
  const time = lines.filter((line) => line.source === 'SessionTime')
  const shown = [...mine, ...time].reduce(
    (sum, line) => sum + Number(line.total ?? 0),
    0
  )
  const running = runningTime(bill, stay, now)
  const rest = Number(bill.total ?? 0) - shown
  const total = Number(bill.total ?? 0) + (running?.charged ?? 0)
  const refunded = Number(bill.refundedTotal ?? 0)

  const placeName = localized(bill.locationName)
  const opened = bill.openedAt
    ? new Date(bill.openedAt).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        { hour: 'numeric', minute: '2-digit' }
      )
    : ''

  const row = 'flex items-baseline justify-between gap-2 tabular-nums'

  return (
    <div className='flex flex-col gap-1 py-3'>
      <button
        type='button'
        className='flex w-full flex-col gap-1 text-start'
        onClick={() => setOpen(true)}
      >
        <div className='flex w-full items-center gap-2'>
          <span
            className={`size-2.5 shrink-0 rounded-full ${billDotClass(bill)}`}
          />
          <span className='text-[15px] font-semibold'>{opened}</span>
          <span className='text-muted-foreground flex min-w-0 items-center gap-1 text-[13px]'>
            {bill.placeId != null && (
              <PlaceIcon
                kind={placeKindOf(bill.placeKind)}
                className='h-3.5 w-3.5 shrink-0'
              />
            )}
            <span className='truncate'>{placeName || t('atTheCounter')}</span>
          </span>
          <div className='ms-auto flex shrink-0 items-center gap-1'>
            <BillPill bill={bill} />
            <ChevronRight className='text-muted-foreground/60 h-4 w-4 rtl:rotate-180' />
          </div>
        </div>

        <div className='flex w-full flex-col gap-1 ps-[18px]'>
          {mine.map((line) => (
            <BillLine key={String(line.id)} line={line} />
          ))}
          {time.map((line) => (
            <BillLine key={String(line.id)} line={line} />
          ))}
          {running && <RunningTimeLine bill={bill} running={running} />}
          {Math.abs(rest) >= 0.005 && (
            <div className={`${row} text-muted-foreground text-[13px]`}>
              <span>{t('restOfBill')}</span>
              <span>
                {rest < 0 && '−'}
                {price(Math.abs(rest))}
              </span>
            </div>
          )}
          <div className={`${row} pt-1 text-[15px] font-bold`}>
            <span>{t('total')}</span>
            <span>
              {running && '≈ '}
              {price(total)}
            </span>
          </div>
          {refunded > 0 && (
            <div className={`${row} text-destructive text-[13px]`}>
              <span>{t('refunded')}</span>
              <span>−{price(refunded)}</span>
            </div>
          )}
        </div>
      </button>

      {/* A paid bill is the thanks: the stars for the rounds on it, at the
          one moment the customer is already looking */}
      {isSettled(bill) && ordersById && (
        <div className='ps-[18px]'>
          <BillStars bill={bill} ordersById={ordersById} />
        </div>
      )}

      <BillSheet bill={bill} open={open} onOpenChange={setOpen} />
    </div>
  )
}

const percent = (rate: number | string | null | undefined) =>
  Math.round(Number(rate ?? 0) * 100)

/** One of the customer's own lines, or the room's time, on the tile. */
function BillLine({ line }: { line: BillLineView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const isTime = line.source === 'SessionTime'
  const qty = Number(line.qty ?? 0)

  return (
    <div>
      <div className='flex items-baseline gap-1 text-sm'>
        {isTime ? (
          <Timer className='text-muted-foreground h-3.5 w-3.5 shrink-0 self-center' />
        ) : (
          <span className='text-muted-foreground'>{qty}x</span>
        )}
        <span className='min-w-0 flex-1'>{localized(line.description)}</span>
        <span className='shrink-0 tabular-nums'>
          {price(Number(line.total ?? 0))}
        </span>
      </div>
      {isTime ? (
        <p className='text-muted-foreground ms-6 text-xs tabular-nums'>
          {t('hoursShort', { count: String(qty) })} ×{' '}
          {price(Number(line.unitPrice ?? 0))}
          {t('perHourShort')}
        </p>
      ) : (
        localized(line.details) && (
          <p className='text-muted-foreground ms-6 text-xs'>
            {localized(line.details)}
          </p>
        )
      )}
    </div>
  )
}

/** The clock still running: its time so far, as the till will bill it. */
function RunningTimeLine({
  bill,
  running,
  slip = false,
}: {
  bill: BillView
  running: RunningTime
  /** On the slip: no icon, the smaller type */
  slip?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const place = localized(bill.locationName)
  const hours = Math.floor(running.minutes / 60)
  const minutes = Math.floor(running.minutes % 60)
  const elapsed = `${hours}:${String(minutes).padStart(2, '0')}`
  const perOption = running.parts.length > 1

  return (
    <div>
      {running.parts.map((part, i) => (
        <div key={i}>
          <div
            className={cn(
              'flex items-baseline gap-1',
              slip ? 'justify-between gap-2' : 'text-sm'
            )}
          >
            {!slip && (
              <Timer className='text-muted-foreground h-3.5 w-3.5 shrink-0 self-center' />
            )}
            <span className='min-w-0 flex-1'>
              {t('timeSoFar', { place })}
              {perOption && ` — ${localized(part.optionName)}`}
            </span>
            <span className='shrink-0 tabular-nums'>≈ {price(part.cost)}</span>
          </div>
          <p
            className={cn(
              'tabular-nums',
              slip ? 'text-[10px]' : 'text-muted-foreground ms-6 text-xs'
            )}
          >
            {i === 0 && `${elapsed} · `}
            {t('hoursShort', { count: String(part.hours) })} ×{' '}
            {price(part.rate)}
            {t('perHourShort')}
          </p>
        </div>
      ))}
    </div>
  )
}

/**
 * What the till did with the bill: paid (and on which receipt), on the
 * customer's tab, voided — or still unpaid.
 */
function BillPill({ bill }: { bill: BillView }) {
  const t = useT()

  if (bill.status === 'Voided') {
    return (
      <Badge variant='outline' className='text-muted-foreground'>
        {t('voided')}
      </Badge>
    )
  }
  if (!isSettled(bill)) {
    return <Badge variant='outline'>{t('unpaid')}</Badge>
  }
  return (
    <Badge variant='secondary' className='tabular-nums'>
      {bill.paidWith === 'Account' ? t('onYourTab') : t('paid')}
      {bill.receiptNumber != null &&
        ` ${t('receiptShort', { number: Number(bill.receiptNumber) })}`}
    </Badge>
  )
}

const tenderKey: Record<string, TranslationKey> = {
  Cash: 'cash',
  Card: 'card',
  InstaPay: 'instapay',
  Account: 'account',
  Mixed: 'paidSeveralWays',
}

/**
 * The bill itself, behind a tap on the tile: the slip the till would
 * print, with every line on the ticket and who ordered it, the room's
 * time, the discount, service and VAT, the total, and how it was paid.
 * The customer is on this bill, so nobody on it is hidden from them.
 */
function BillSheet({
  bill,
  open,
  onOpenChange,
}: {
  bill: BillView
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const auth = useAuth()
  const stay = useActiveStay()
  const now = useNow()

  const lines = bill.lines ?? []
  const running = runningTime(bill, stay, now)
  const subtotal = Number(bill.subtotal ?? 0)
  const discount = Number(bill.discount ?? 0)
  const service = Number(bill.serviceCharge ?? 0)
  const vat = Number(bill.vat ?? 0)
  const total = Number(bill.total ?? 0) + (running?.charged ?? 0)
  const refunded = Number(bill.refundedTotal ?? 0)
  const hasBreakdown = discount > 0 || service > 0 || vat > 0
  const locale = language === 'ar' ? 'ar-EG' : 'en-US'
  const closed = closedAt(bill)

  const row = 'flex items-baseline justify-between gap-2 tabular-nums'
  // The dashed rule a thermal printer draws between the slip's parts
  const rule = <div className='border-t border-dashed border-black' />

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='bg-muted mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'
      >
        <SheetTitle className='sr-only'>{t('receipt')}</SheetTitle>
        <div className='bg-muted-foreground/40 mx-auto mb-3 h-1 w-10 rounded-full' />

        <div className='max-h-[75svh] overflow-y-auto'>
          {/* The paper the till prints, on screen: black on white whatever
              the theme, 72mm wide */}
          <div className='mx-auto flex w-full max-w-[300px] flex-col gap-2 bg-white px-4 py-5 text-[12px] leading-snug text-black shadow-sm'>
            <div className='flex flex-col items-center text-center'>
              <div className='text-[13px] font-semibold'>
                {bill.receiptNumber != null
                  ? t('receiptNumber', { number: Number(bill.receiptNumber) })
                  : localized(bill.locationName) || t('atTheCounter')}
              </div>
              {bill.receiptNumber != null && localized(bill.locationName) && (
                <div className='text-[11px]'>
                  {localized(bill.locationName)}
                </div>
              )}
              {bill.openedAt && (
                <div className='text-[11px] tabular-nums'>
                  {new Date(bill.openedAt).toLocaleString(locale, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                  {closed &&
                    ` – ${closed.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}`}
                </div>
              )}
              {bill.status === 'Voided' && (
                <div className='text-[11px] font-semibold'>{t('voided')}</div>
              )}
            </div>

            {rule}

            <div className='flex flex-col gap-1.5'>
              {lines.map((line) => (
                <SlipLine key={String(line.id)} line={line} />
              ))}
              {running && (
                <RunningTimeLine bill={bill} running={running} slip />
              )}
            </div>

            {rule}

            {hasBreakdown && (
              <div className='flex flex-col gap-0.5 text-[11px]'>
                <div className={row}>
                  <span>{t('subtotal')}</span>
                  <span>{price(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className={row}>
                    <span>
                      {t('discount')}
                      {bill.discountRate != null &&
                        ` ${percent(bill.discountRate)}%`}
                    </span>
                    <span>−{price(discount)}</span>
                  </div>
                )}
                {service > 0 && (
                  <div className={row}>
                    <span>
                      {t('serviceCharge', {
                        rate: String(percent(bill.serviceChargeRate)),
                      })}
                    </span>
                    <span>{price(service)}</span>
                  </div>
                )}
                {vat > 0 && !bill.vatIncluded && (
                  <div className={row}>
                    <span>
                      {t('vat', { rate: String(percent(bill.vatRate)) })}
                    </span>
                    <span>{price(vat)}</span>
                  </div>
                )}
              </div>
            )}

            <div className={`${row} text-[15px] font-bold`}>
              <span>{t('total')}</span>
              <span>
                {running && '≈ '}
                {price(total)}
              </span>
            </div>
            {vat > 0 && bill.vatIncluded && (
              <div className={`${row} -mt-1 text-[10px]`}>
                <span>
                  {t('vatIncluded', { rate: String(percent(bill.vatRate)) })}
                </span>
                <span>{price(vat)}</span>
              </div>
            )}

            {isSettled(bill) && bill.paidWith && (
              <div className={row}>
                <span>
                  {tenderKey[bill.paidWith]
                    ? t(tenderKey[bill.paidWith])
                    : bill.paidWith}
                </span>
                <span>{price(Number(bill.total ?? 0))}</span>
              </div>
            )}
            {refunded > 0 && (
              <div className={`${row} font-medium`}>
                <span>{t('refunded')}</span>
                <span>−{price(refunded)}</span>
              </div>
            )}
          </div>

          {/* The printed receipt, with the branch's own header and footer,
              once there is one — for an account, as the page is */}
          {isSettled(bill) && auth.isAuthenticated && bill.id != null && (
            <Button
              asChild
              variant='outline'
              className='mt-4 w-full rounded-full'
            >
              <Link
                to='/receipts/$ticketId'
                params={{ ticketId: String(bill.id) }}
              >
                <ReceiptText className='h-4 w-4' />
                {t('receipt')}
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** A line as the till prints it: the description and its total, then
 *  quantity × price, any discount, and the name the till put on it. */
function SlipLine({ line }: { line: BillLineView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const isTime = line.source === 'SessionTime'
  const qty = Number(line.qty ?? 0)
  const discount = Number(line.discount ?? 0)
  const who = line.customerName

  return (
    <div>
      <div className='flex items-baseline justify-between gap-2'>
        <span>{localized(line.description)}</span>
        <span className='shrink-0 tabular-nums'>
          {price(Number(line.total ?? 0))}
        </span>
      </div>
      <div className='text-[10px] tabular-nums'>
        {isTime ? t('hoursShort', { count: String(qty) }) : qty} ×{' '}
        {price(Number(line.unitPrice ?? 0))}
        {isTime && t('perHourShort')}
        {discount > 0 && ` − ${price(discount)} (${t('discount')})`}
        {who && ` · ${who}`}
      </div>
      {localized(line.details) && (
        <div className='text-[10px]'>{localized(line.details)}</div>
      )}
    </div>
  )
}

/**
 * The rating, on the paid bill: one row of stars for the customer's own
 * rounds on it. Rating is account-only server-side, so a guest gets none.
 * Rated already, it shows what they gave.
 */
function BillStars({
  bill,
  ordersById,
}: {
  bill: BillView
  ordersById: Map<number, OrderSummary>
}) {
  const t = useT()
  const auth = useAuth()
  if (!auth.isAuthenticated) return null

  const mine = [
    ...new Set(
      (bill.lines ?? [])
        .filter((line) => line.isMine && line.orderId != null)
        .map((line) => Number(line.orderId))
    ),
  ]
    .map((id) => ordersById.get(id))
    .filter((order): order is OrderSummary => order != null)
  if (mine.length === 0) return null

  const unrated = mine.filter((order) => order.ratingValue == null)
  if (unrated.length === 0) {
    const value = Number(mine[0].ratingValue ?? 0)
    return (
      <div className='flex items-center gap-1 pt-1'>
        <span className='text-muted-foreground text-[13px]'>
          {t('yourRating')}
        </span>
        <StarsDisplay value={value} />
      </div>
    )
  }
  return (
    <StarRow orderIds={unrated.map((order) => Number(order.orderNumber))} />
  )
}

function StarsDisplay({ value }: { value: number }) {
  return (
    <span className='text-muted-foreground flex gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= value ? 'fill-current' : 'opacity-40'}`}
        />
      ))}
    </span>
  )
}

/** Five stars, one tap, for every round of theirs the bill covered. */
function StarRow({ orderIds }: { orderIds: number[] }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [hover, setHover] = useState(0)
  const [given, setGiven] = useState(0)

  const rate = useMutation({
    mutationFn: async (value: number) => {
      for (const orderId of orderIds) {
        await rateOrder({
          path: { orderId },
          body: { ratingValue: value, comment: null },
          headers: { 'x-requestid': crypto.randomUUID() },
          query: { 'api-version': API_VERSION },
          throwOnError: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
    },
    onError: () => setGiven(0),
  })

  if (rate.isSuccess) {
    return (
      <span className='text-muted-foreground pt-1 text-[13px]'>
        {t('ratedThanks')}
      </span>
    )
  }

  return (
    <div className='flex flex-wrap items-center gap-2 pt-1'>
      <span className='text-[13px] font-semibold'>{t('howWasIt')}</span>
      <div
        className='text-amber-400 flex items-center'
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type='button'
            aria-label={String(value)}
            disabled={rate.isPending}
            className='p-0.5'
            onMouseEnter={() => setHover(value)}
            onClick={() => {
              setGiven(value)
              rate.mutate(value)
            }}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                value <= (hover || given)
                  ? 'fill-current'
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
        {rate.isPending && (
          <Loader2 className='text-muted-foreground ms-1 h-4 w-4 animate-spin' />
        )}
      </div>
    </div>
  )
}

// ── Orders not on a bill: sent and waiting, or turned down ──

function OrderGroup({
  title,
  orders,
}: {
  title: string
  orders: OrderSummary[]
}) {
  if (orders.length === 0) return null
  return (
    <div className='flex flex-col'>
      <h3 className='text-muted-foreground pt-2 pb-1 text-[13px] font-semibold'>
        {title}
      </h3>
      <div className='divide-y border-b'>
        {orders.map((order) => (
          <OrderTile key={String(order.orderNumber)} order={order} />
        ))}
      </div>
    </div>
  )
}

/** An order the till has not put on a bill: where it was sent, and what is
 *  in it. The status dot says what the till did. */
function OrderTile({ order }: { order: OrderSummary }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)

  const detailQuery = useQuery(
    getOrderOptions({
      path: { orderId: Number(order.orderNumber) },
      query: { 'api-version': API_VERSION },
    })
  )
  const discount = Number(order.loyaltyDiscount ?? 0)
  // LEGACY(places): roomName is the fallback for orders from before the
  // Places remodel — remove when Ordering stops filling the old room fields.
  const placeName = localized(order.placeName ?? order.roomName)

  return (
    <div className='flex items-start gap-2 py-3'>
      <span
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${statusDotClass(order.status)}`}
      />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='text-[15px] font-semibold'>
          {order.date &&
            new Date(order.date).toLocaleTimeString(
              language === 'ar' ? 'ar-EG' : 'en-US',
              { hour: 'numeric', minute: '2-digit' }
            )}
        </div>
        {placeName && (
          <div className='text-muted-foreground flex items-center gap-1 text-[13px]'>
            <PlaceIcon
              kind={placeKindOf(order.placeKind)}
              className='h-3.5 w-3.5 shrink-0'
            />
            <span className='truncate'>{placeName}</span>
          </div>
        )}
        {detailQuery.isLoading ? (
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
        ) : detailQuery.isError ? (
          <p className='text-destructive text-[13px]'>
            {t('failedToLoadDetails')}
          </p>
        ) : (
          detailQuery.data && <OrderItems order={detailQuery.data} />
        )}
      </div>
      <div className='shrink-0 text-end'>
        <div className='text-[15px] font-bold tabular-nums'>
          {price(Number(order.total ?? 0) - discount)}
        </div>
        {discount > 0 && (
          <div className='flex items-center justify-end gap-0.5 text-xs text-green-600 dark:text-green-500'>
            <Star className='h-3 w-3 fill-current' />
            {t('discountFormat', { price: discount.toFixed(2) })}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderItems({ order }: { order: Order }) {
  const t = useT()
  const localized = useLocalized()

  return (
    <div className='flex flex-col gap-1'>
      {(order.orderItems ?? []).map((item, index) => (
        <div key={index}>
          <div className='flex items-baseline gap-1 text-sm'>
            <span className='text-muted-foreground'>
              {Number(item.units ?? 0)}x
            </span>
            <span className='min-w-0 flex-1'>
              {localized(item.productName)}
            </span>
          </div>
          {item.customizationsDescription && (
            <p className='text-muted-foreground ms-6 text-xs'>
              {localized(item.customizationsDescription)}
            </p>
          )}
          {item.specialInstructions && (
            <p className='text-muted-foreground ms-6 text-xs italic'>
              "{item.specialInstructions}"
            </p>
          )}
        </div>
      ))}
      {order.customerNote && (
        <p className='text-muted-foreground text-[13px]'>
          {t('noteWithText', { notes: order.customerNote })}
        </p>
      )}
    </div>
  )
}
