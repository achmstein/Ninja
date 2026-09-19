import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import {
  CircleAlert,
  Loader2,
  ReceiptText,
  Star,
  Tag,
  Timer,
} from 'lucide-react'
import { rateOrder, type Order, type OrderSummary } from '@/api/ordering'
import {
  getOrderOptions,
  getOrdersByUserOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { type BillLineView, type BillView } from '@/api/sales'
import { API_VERSION } from '@/lib/api-client'
import {
  billParts,
  closedAt,
  isSettled,
  isTimeLine,
  isUnassigned,
  percent,
  runningTime,
  useMyBills,
  useNow,
} from '@/lib/bills'
import { statusDotClass } from '@/lib/order-status'
import { PLACE_ROOM, PLACE_STATION, PLACE_TABLE, PlaceIcon } from '@/lib/places'
import { useActiveStay, useMyStays } from '@/lib/stays'
import { dayStartHour, isOvernightShift, useSelectedBranch } from '@/lib/branch'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RunningTimeLine } from '@/components/bills/bill-slip'
import { SignInOptions } from '@/components/sign-in-options'
import { useGuestStore } from '@/stores/guest-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useFeatures } from '@/lib/brand'

export const Route = createFileRoute('/bills')({
  component: BillsRoute,
})

/**
 * Open to guests: Sales and Ordering both know a guest by the id this
 * browser sends. Only a visitor who has neither an account nor a guest id
 * has nothing to show, and they get the sign-in prompt.
 */
function BillsRoute() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)

  if (!auth.isAuthenticated && !auth.isLoading && !guestId) {
    return <SignedOutPrompt />
  }

  return <BillsPage />
}

function SignedOutPrompt() {
  const t = useT()
  return (
    <div className='flex h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center'>
      <ReceiptText className='text-muted-foreground/40 h-12 w-12' />
      <p className='text-muted-foreground'>{t('signInForBills')}</p>
      <SignInOptions />
    </div>
  )
}

/** Ordering and Sales spell the kind by name ("Table"); the icons go by number. */
function placeKindOf(kind: string | null | undefined): number {
  return kind === 'Table'
    ? PLACE_TABLE
    : kind === 'Station'
      ? PLACE_STATION
      : PLACE_ROOM
}

/**
 * The bills tab (docs/visit-tab.html): the customer's bills, not their orders.
 * everything the cafe charges — the rounds, a room's time, a discount,
 * service and VAT — lands on a Sales ticket, and the till's own arithmetic
 * is what the customer sees. One tile per bill they are on today, open ones
 * first with what they add up to over them; an order the till has not
 * confirmed yet waits above, since it is on no bill until then.
 */
function BillsPage() {
  const t = useT()

  // One read covers both tabs: open bills whatever their age (last night's
  // unpaid table is still today's) and closed ones back to the history
  const billsQuery = useMyBills()
  const { dayStart } = billsQuery
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
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('bills')}</h1>

      <Tabs defaultValue='today'>
        <TabsList className='w-full'>
          <TabsTrigger value='today' className='flex-1'>
            {t('today')}
          </TabsTrigger>
          <TabsTrigger value='history' className='flex-1'>
            {t('earlier')}
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
              <OnYourTab />
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
            <EmptyState title={t('noBillsYet')} />
          ) : (
            <HistoryList bills={pastBills} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * What the customer owes the cafe, as the till decided it: the balance of
 * their tab in Accounts, where a settled share lands when the cashier puts
 * it on account. No sum of the open bills — the app cannot know their
 * part of an unsettled room's time, so it does not guess one. Only for
 * an account that owes; a tap opens the tab.
 */
function OnYourTab() {
  const t = useT()
  const price = usePrice()
  const auth = useAuth()
  const features = useFeatures()
  const accountQuery = useQuery({
    ...getMyAccountOptions(),
    enabled: auth.isAuthenticated && features.tabs,
    retry: false,
  })
  const balance = accountQuery.isError
    ? 0
    : Number(accountQuery.data?.balance ?? 0)
  if (!features.tabs || balance <= 0) return null

  return (
    <Link to='/account' className='flex items-baseline justify-between py-2'>
      <span className='text-muted-foreground text-[13px]'>
        {t('onYourTab')}
      </span>
      <span className='text-destructive text-lg font-bold tabular-nums'>
        {price(balance)}
      </span>
    </Link>
  )
}

/** The stay a bill charges the time of, from the customer's own stays —
 *  running or ended — for its roster. A guest has none. */
function useStayOf() {
  const { data: stays = [] } = useMyStays()
  return (bill: BillView) =>
    bill.sessionId == null
      ? undefined
      : stays.find((s) => Number(s.id) === Number(bill.sessionId))
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
      <p>{t('failedToLoadBills')}</p>
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

  // The tile is the customer's own view of the bill: their rounds, the
  // rounds the till named nobody for, and the place's time as the
  // group's. A bill with nobody else on it adds up to its total, with the
  // till's discount, service and VAT under the lines; one with somebody
  // else's rounds ends on the customer's own, with the whole bill's total
  // under it — whose the time is, the till decides at settle. The tap
  // opens the bill, which itemises everything with the names on it.
  const lines = bill.lines ?? []
  const mine = lines.filter((line) => line.isMine && !isTimeLine(line))
  const unassigned = lines.filter(isUnassigned)
  const time = lines.filter(isTimeLine)
  const stayOf = useStayOf()
  const running = runningTime(bill, stay, now)
  const parts = billParts(bill, running, stayOf(bill))
  const { shared } = parts
  const discount = Number(bill.discount ?? 0)
  const service = Number(bill.serviceCharge ?? 0)
  const vat = Number(bill.vat ?? 0)
  const refunded = Number(bill.refundedTotal ?? 0)

  const placeName = localized(bill.locationName)
  const opened = bill.openedAt
    ? new Date(bill.openedAt).toLocaleTimeString(
        language === 'ar' ? 'ar-EG' : 'en-US',
        { hour: 'numeric', minute: '2-digit' }
      )
    : ''

  const row = 'flex items-baseline justify-between gap-2 tabular-nums'
  const muted = `${row} text-muted-foreground text-[13px]`

  return (
    <div className='flex flex-col gap-1 py-3'>
      <Link
        to='/receipts/$ticketId'
        params={{ ticketId: String(bill.id) }}
        className='flex w-full flex-col gap-1'
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
          <div className='ms-auto shrink-0'>
            <BillPill bill={bill} />
          </div>
        </div>

        <div className='flex w-full flex-col gap-1 ps-[18px]'>
          {mine.map((line) => (
            <BillLine key={String(line.id)} line={line} />
          ))}
          {unassigned.map((line) => (
            <BillLine key={String(line.id)} line={line} />
          ))}
          {time.map((line) => (
            <BillLine key={String(line.id)} line={line} />
          ))}
          {running && <RunningTimeLine bill={bill} running={running} />}

          {shared ? (
            <>
              <div className={`${row} pt-1 text-[15px] font-bold`}>
                <span>{t('yourRounds')}</span>
                <span>{price(parts.ownLines)}</span>
              </div>
              <div className={muted}>
                <span>{t('billTotal')}</span>
                <span>
                  {running && '≈ '}
                  {price(parts.total)}
                </span>
              </div>
            </>
          ) : (
            <>
              {discount > 0 && (
                <div className={muted}>
                  <span>
                    {t('discount')}
                    {bill.discountRate != null &&
                      ` ${percent(bill.discountRate)}%`}
                  </span>
                  <span>−{price(discount)}</span>
                </div>
              )}
              {service > 0 && (
                <div className={muted}>
                  <span>
                    {t('serviceCharge', {
                      rate: String(percent(bill.serviceChargeRate)),
                    })}
                  </span>
                  <span>{price(service)}</span>
                </div>
              )}
              {vat > 0 && !bill.vatIncluded && (
                <div className={muted}>
                  <span>
                    {t('vat', { rate: String(percent(bill.vatRate)) })}
                  </span>
                  <span>{price(vat)}</span>
                </div>
              )}
              <div className={`${row} pt-1 text-[15px] font-bold`}>
                <span>{t('total')}</span>
                <span>
                  {running && '≈ '}
                  {price(parts.total)}
                </span>
              </div>
            </>
          )}
          {refunded > 0 && (
            <div className={`${row} text-destructive text-[13px]`}>
              <span>{t('refunded')}</span>
              <span>−{price(refunded)}</span>
            </div>
          )}
        </div>
      </Link>

      {/* A paid bill is the thanks: the stars for the rounds on it, at the
          one moment the customer is already looking */}
      {isSettled(bill) && ordersById && (
        <div className='ps-[18px]'>
          <BillStars bill={bill} ordersById={ordersById} />
        </div>
      )}
    </div>
  )
}

/** One of the customer's own lines, or the place's time, whole. A round the
 *  till named nobody for is muted: on the bill, but not read as theirs. */
function BillLine({ line }: { line: BillLineView }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const isTime = line.source === 'SessionTime'
  const qty = Number(line.qty ?? 0)

  return (
    <div className={cn(isUnassigned(line) && 'text-muted-foreground')}>
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

/**
 * Five stars on the paid bill. A tap on one opens the rating sheet with
 * that star chosen and room for a word, as the app does; the sheet rates
 * every round of theirs the bill covered.
 */
function StarRow({ orderIds }: { orderIds: number[] }) {
  const t = useT()
  const [hover, setHover] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  if (done) {
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
            className='p-0.5'
            onMouseEnter={() => setHover(value)}
            onClick={() => setChosen(value)}
          >
            <Star
              className={cn(
                'h-5 w-5 transition-colors',
                value <= hover ? 'fill-current' : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
      </div>
      <RatingSheet
        orderIds={orderIds}
        initialRating={chosen ?? 5}
        open={chosen != null}
        onOpenChange={(open) => {
          if (!open) setChosen(null)
        }}
        onRated={() => setDone(true)}
      />
    </div>
  )
}

// ── Rating bottom sheet (mobile parity) ──

const RATING_LABELS: Record<number, TranslationKey> = {
  1: 'ratingPoor',
  2: 'ratingFair',
  3: 'ratingGood',
  4: 'ratingVeryGood',
  5: 'ratingExcellent',
}

function RatingSheet({
  orderIds,
  initialRating,
  open,
  onOpenChange,
  onRated,
}: {
  orderIds: number[]
  initialRating: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onRated: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(initialRating)
  const [comment, setComment] = useState('')

  // The star tapped on the tile is the sheet's starting point each time it
  // opens, and the comment box starts empty
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRating(initialRating)
      setComment('')
    }
  }

  const rateAll = useMutation({
    mutationFn: async () => {
      for (const orderId of orderIds) {
        await rateOrder({
          path: { orderId },
          body: { ratingValue: rating, comment: comment.trim() || null },
          headers: { 'x-requestid': crypto.randomUUID() },
          query: { 'api-version': API_VERSION },
          throwOnError: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      onRated()
      onOpenChange(false)
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      >
        <div className='bg-muted-foreground mx-auto mb-4 h-1 w-10 rounded-full' />

        <SheetHeader className='p-0 text-start'>
          <SheetTitle className='pe-8 text-xl font-bold'>
            {t('rateYourOrder')}
          </SheetTitle>
        </SheetHeader>

        <div className='mt-6 flex justify-center gap-1'>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type='button'
              disabled={rateAll.isPending}
              onClick={() => setRating(star)}
              aria-label={`${star} stars`}
            >
              <Star
                className={`h-10 w-10 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
              />
            </button>
          ))}
        </div>
        <p className='text-muted-foreground mt-2 text-center text-[15px]'>
          {t(RATING_LABELS[rating])}
        </p>

        <p className='mt-6 text-sm font-semibold'>{t('yourReviewOptional')}</p>
        <Textarea
          rows={3}
          maxLength={500}
          className='mt-2'
          placeholder={t('shareYourExperience')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {rateAll.isError && (
          <div className='bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-lg p-3 text-[13px]'>
            <CircleAlert className='h-4 w-4 shrink-0' />
            {t('failedToPlaceOrder')}
          </div>
        )}

        <Button
          size='lg'
          className='mt-6 w-full rounded-full font-bold'
          disabled={rateAll.isPending}
          onClick={() => rateAll.mutate()}
        >
          {rateAll.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('submitRating')
          )}
        </Button>
      </SheetContent>
    </Sheet>
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
  const promoDiscount = Number(order.promoDiscount ?? 0)
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
        {promoDiscount > 0 && (
          <div className='flex items-center justify-end gap-0.5 text-xs text-green-600 dark:text-green-500'>
            <Tag className='h-3 w-3' />
            {t('discountFormat', { price: promoDiscount.toFixed(2) })}
          </div>
        )}
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
