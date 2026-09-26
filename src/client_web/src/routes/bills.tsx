import * as React from 'react'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CircleAlert, History, ReceiptText, Wallet } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { getOrdersByUserOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { type BillView } from '@/api/sales'
import { closedAt, isOpen, useMyBills, useNow } from '@/lib/bills'
import { useFeatures } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import { BillCard, FORMING_BILL, type PendingRound } from '@/components/bills/bill-card'
import { HistoryList } from '@/components/bills/bills-history'
import { OrderGroup } from '@/components/bills/waiting-orders'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty } from '@/components/ninja/page/parts'
import { PaySheet } from '@/components/pay/pay-sheet'
import { SignInOptions } from '@/components/sign-in-options'
import { TileButton, TileGroup, TileLink } from '@/components/tile-row'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useGuestStore } from '@/stores/guest-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/bills')({
  // ?pay=<ticketId> opens the pay sheet on that bill: where a guest comes
  // back to after a payment that did not go through
  validateSearch: (search: Record<string, unknown>): { pay?: number } => {
    const pay = Number(search.pay)
    return Number.isInteger(pay) && pay > 0 ? { pay } : {}
  },
  component: BillsRoute,
})

/**
 * Open to guests: Sales and Ordering both know a guest by the id this
 * browser sends. Only a visitor who has neither an account nor a guest id
 * has nothing to show, and they get the sign-in prompt.
 */
function BillsRoute() {
  const t = useT()
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)

  if (!auth.isAuthenticated && !auth.isLoading && !guestId) {
    return (
      <NinjaPage title={t('bills')}>
        <Empty icon={ReceiptText} title={t('signInForBills')} className='pb-4'>
          <div className='w-full max-w-sm'>
            <SignInOptions />
          </div>
        </Empty>
      </NinjaPage>
    )
  }

  return <BillsPage />
}

/**
 * The bills tab (docs/visit-tab.html): the customer's bills, not their orders.
 * everything the cafe charges — the rounds, a room's time, a discount,
 * service and VAT — lands on a Sales ticket, and the till's own arithmetic
 * is what the customer sees. An open bill has the tab to itself, its rounds
 * standing open, an order still on its way already on it as a faint round;
 * closed bills wait behind one row that opens them in a sheet. With nothing
 * open the tab is the history.
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
  // Confirmed, but Sales has not put it on a bill yet: it does so off its
  // own copy of the event, a moment after this page hears the order was
  // confirmed. Shown until the bill has it, rather than gone until a refresh
  const onBills = new Set(
    bills.flatMap((bill) => (bill.lines ?? []).map((line) => Number(line.orderId ?? 0)))
  )
  const addingToBill = todayOrders.filter(
    (order) =>
      order.status?.toLowerCase() === 'confirmed' &&
      !onBills.has(Number(order.orderNumber))
  )
  const catchingUp = addingToBill.length > 0
  const refetchBills = billsQuery.refetch
  useEffect(() => {
    if (!catchingUp) return
    const timer = setInterval(() => void refetchBills(), 2000)
    return () => clearInterval(timer)
  }, [catchingUp, refetchBills])
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

  const openBills = todayBills.filter(isOpen)
  const closedBills = [...todayBills.filter((bill) => !isOpen(bill)), ...pastBills]
  const { byBill, forming } = placeRounds(openBills, waiting, addingToBill)
  // A round turned down says so for a while, then leaves the page
  const now = useNow()
  const turnedDown = cancelled.filter((order) => order.date && now - new Date(order.date).getTime() < TURNED_DOWN_MS)
  const live = openBills.length > 0 || forming != null
  const [earlierOpen, setEarlierOpen] = useState(false)

  return (
    <NinjaPage title={t('bills')}>
      {loading ? (
        <BillsSkeleton />
      ) : billsQuery.isError && ordersQuery.isError ? (
        <ErrorState onRetry={retry} />
      ) : live ? (
        // An open bill has the tab to itself; what is closed waits behind one row
        <Rise key='live' className='flex flex-col gap-5'>
          <RiseItem>
            <OpenBills>
              {forming && <BillCard key={FORMING_BILL} bill={forming.bill} pending={forming.rounds} ordersById={ordersById} takeover />}
              {openBills.map((bill) => (
                <BillCard key={String(bill.id)} bill={bill} pending={byBill.get(String(bill.id))} ordersById={ordersById} takeover />
              ))}
            </OpenBills>
          </RiseItem>
          {turnedDown.length > 0 && (
            <RiseItem>
              <OrderGroup title={t('statusCancelled')} orders={turnedDown} />
            </RiseItem>
          )}
          <OnYourTab />
          {closedBills.length > 0 && (
            <RiseItem>
              <TileGroup>
                <TileButton icon={History} label={t('ninjaEarlierBills')} value={String(closedBills.length)} onClick={() => setEarlierOpen(true)} />
              </TileGroup>
            </RiseItem>
          )}
        </Rise>
      ) : closedBills.length === 0 && turnedDown.length === 0 ? (
        <Empty icon={ReceiptText} title={t('nothingOnYouToday')} />
      ) : (
        // Nothing open: the tab is the history, today's first
        <Rise key='quiet' className='flex flex-col gap-5'>
          <OnYourTab />
          {turnedDown.length > 0 && (
            <RiseItem>
              <OrderGroup title={t('statusCancelled')} orders={turnedDown} />
            </RiseItem>
          )}
          <RiseItem>
            <HistoryList bills={closedBills} ordersById={ordersById} />
          </RiseItem>
        </Rise>
      )}

      <Sheet open={earlierOpen} onOpenChange={setEarlierOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{t('ninjaEarlierBills')}</SheetTitle>
          </SheetHeader>
          <HistoryList bills={closedBills} ordersById={ordersById} />
        </SheetContent>
      </Sheet>
      <RetryPay />
    </NinjaPage>
  )
}

/** How long a turned-down round stays on the page, ms */
const TURNED_DOWN_MS = 30 * 60_000

/**
 * The rounds on their way, each put with the open bill it will land on:
 * the one at the same place, else the first open one. With no open bill at
 * all they wait on a bill of their own that the till has not opened yet,
 * named after where they were sent, adding up to what was ordered.
 */
function placeRounds(openBills: BillView[], waiting: OrderSummary[], adding: OrderSummary[]) {
  const byBill = new Map<string, PendingRound[]>()
  const orphans: Array<{ round: PendingRound; order: OrderSummary }> = []
  const all = [
    ...waiting.map((order) => ({ order, stage: 'waiting' as const })),
    ...adding.map((order) => ({ order, stage: 'adding' as const })),
  ].sort((x, y) => new Date(y.order.date ?? 0).getTime() - new Date(x.order.date ?? 0).getTime())
  for (const { order, stage } of all) {
    const round: PendingRound = { orderId: Number(order.orderNumber), date: order.date, stage }
    const bill = openBills.find((b) => b.placeId != null && String(b.placeId) === String(order.placeId)) ?? openBills[0]
    if (bill) byBill.set(String(bill.id), [...(byBill.get(String(bill.id)) ?? []), round])
    else orphans.push({ round, order })
  }
  if (orphans.length === 0) return { byBill, forming: null }
  const first = orphans[0].order
  const bill: BillView = {
    id: FORMING_BILL,
    status: 'Open',
    placeId: first.placeId,
    placeKind: first.placeKind,
    locationName: first.placeName,
    lines: [],
    total: orphans.reduce((sum, o) => sum + Number(o.order.total ?? 0) - Number(o.order.loyaltyDiscount ?? 0), 0),
  }
  return { byBill, forming: { bill, rounds: orphans.map((o) => o.round) } }
}

/** One open bill fills the width; two or more (a table and a room) sit side by side and swipe, like the menu's categories */
function OpenBills({ children }: { children: React.ReactNode }) {
  const cards = React.Children.toArray(children).filter(Boolean)
  if (cards.length <= 1) return <>{cards}</>
  return (
    <div className='no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4'>
      {cards.map((card, i) => (
        <div key={i} className='w-[88%] shrink-0 snap-center'>
          {card}
        </div>
      ))}
    </div>
  )
}

/** The pay sheet on the bill a failed payment came back from. Read by the
 *  bill's id, which works for anyone who paid a share of it, so a guest who
 *  paid from the table (not on the bill otherwise) gets it too. */
function RetryPay() {
  const { pay } = Route.useSearch()
  const navigate = useNavigate()
  if (pay == null) return null
  return (
    <PaySheet
      source={{ ticketId: pay }}
      start='any'
      open
      onOpenChange={(open) => {
        if (!open) void navigate({ to: '/bills', search: {}, replace: true })
      }}
    />
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
  const balance = accountQuery.isError ? 0 : Number(accountQuery.data?.balance ?? 0)
  if (!features.tabs || balance <= 0) return null

  return (
    <RiseItem>
      <TileGroup>
        <TileLink
          to='/account'
          icon={Wallet}
          label={t('onYourTab')}
          value={<span className='text-destructive text-[15px] font-bold tabular-nums'>{price(balance)}</span>}
        />
      </TileGroup>
    </RiseItem>
  )
}

/** Mirrors a bill card: the place line, the total, the stack under it */
function BillsSkeleton() {
  return (
    <div className='flex flex-col gap-4'>
      {[...Array(2)].map((_, i) => (
        <div key={i} className='surface flex flex-col gap-4 rounded-[1.75rem] p-5'>
          <div className='flex items-center gap-2'>
            <Skeleton className='h-4 w-32' />
            <Skeleton className='ms-auto h-6 w-16 rounded-full' />
          </div>
          <Skeleton className='h-9 w-36' />
          <Skeleton className='h-16 w-full rounded-[1.25rem]' />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  return (
    <Empty icon={CircleAlert} title={t('failedToLoadBills')}>
      <Button variant='outline' className='rounded-full' onClick={onRetry}>
        {t('retry')}
      </Button>
    </Empty>
  )
}
