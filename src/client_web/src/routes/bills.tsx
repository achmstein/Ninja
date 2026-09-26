import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CircleAlert, ReceiptText, Wallet } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { getOrdersByUserOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { closedAt, useMyBills } from '@/lib/bills'
import { useFeatures } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import { BillCard } from '@/components/bills/bill-card'
import { HistoryList } from '@/components/bills/bills-history'
import { OrderGroup } from '@/components/bills/waiting-orders'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Segment } from '@/components/ninja/page/parts'
import { PaySheet } from '@/components/pay/pay-sheet'
import { SignInOptions } from '@/components/sign-in-options'
import { TileGroup, TileLink } from '@/components/tile-row'
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
 * is what the customer sees. One card per bill they are on today, open ones
 * first; an order the till has not confirmed yet waits above, since it is
 * on no bill until then.
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

  const [tab, setTab] = useState<'today' | 'earlier'>('today')
  const orderGroups: Array<{ title: string; orders: OrderSummary[] }> = [
    { title: t('waitingToBeConfirmed'), orders: waiting },
    { title: t('addingToBill'), orders: addingToBill },
    { title: t('statusCancelled'), orders: cancelled },
  ]

  return (
    <NinjaPage title={t('bills')}>
      <Segment
        value={tab}
        onChange={setTab}
        options={[
          { value: 'today', label: t('today') },
          { value: 'earlier', label: t('earlier') },
        ]}
      />
      {tab === 'today' ? (
        loading ? (
          <BillsSkeleton />
        ) : billsQuery.isError && ordersQuery.isError ? (
          <ErrorState onRetry={retry} />
        ) : todayBills.length === 0 && waiting.length === 0 && addingToBill.length === 0 && cancelled.length === 0 ? (
          <Empty icon={ReceiptText} title={t('nothingOnYouToday')} />
        ) : (
          <Rise key='today' className='flex flex-col gap-5'>
            <OnYourTab />
            {orderGroups.map((group) =>
              group.orders.length > 0 ? (
                <RiseItem key={group.title}>
                  <OrderGroup title={group.title} orders={group.orders} />
                </RiseItem>
              ) : null
            )}
            {todayBills.map((bill) => (
              <RiseItem key={String(bill.id)}>
                <BillCard bill={bill} ordersById={ordersById} />
              </RiseItem>
            ))}
          </Rise>
        )
      ) : billsQuery.isLoading ? (
        <BillsSkeleton />
      ) : billsQuery.isError ? (
        <ErrorState onRetry={retry} />
      ) : pastBills.length === 0 ? (
        <Empty icon={ReceiptText} title={t('noBillsYet')} />
      ) : (
        <Rise key='earlier'>
          <RiseItem>
            <HistoryList bills={pastBills} />
          </RiseItem>
        </Rise>
      )}
      <RetryPay />
    </NinjaPage>
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
