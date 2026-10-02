import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CircleAlert, ReceiptText, Wallet } from 'lucide-react'
import { getMyAccountOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { useFeatures } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import { takeAfterPayment, useBackTo } from '@/lib/back-to'
import { useLiveBills } from '@/lib/live-bills'
import { BillsByMonth } from '@/components/bills/bills-history'
import { hasLiveBill, OpenBills } from '@/components/bills/open-bills'
import { OrderGroup } from '@/components/bills/waiting-orders'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty } from '@/components/ninja/page/parts'
import { PaySheet } from '@/components/pay/pay-sheet'
import { SignInOptions } from '@/components/auth/sign-in-options'
import { TileGroup, TileLink } from '@/components/ninja/page/tile-row'
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
      <NinjaPage title={t('ninjaYourBills')} back='/profile' push='bills'>
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
 * Your bills (docs/visit-tab.html), reached from You: the bill running now
 * lives on the menu's dock, and this is where all of them are kept. What
 * the business charges (the rounds, a room's time, a discount, service and VAT)
 * lands on a Sales ticket, and the till's own arithmetic is what the
 * customer sees. The bills open now come first, standing open; then the
 * history, month by month.
 */
function BillsPage() {
  const t = useT()
  const live = useLiveBills()
  // Opened from a payment's outcome: back goes to the menu, not to that outcome again
  const [afterPayment] = useState(takeAfterPayment)
  useBackTo('/', afterPayment)

  return (
    <NinjaPage title={t('ninjaYourBills')} back='/profile' push='bills'>
      {live.loading ? (
        <BillsSkeleton />
      ) : live.failed ? (
        <Empty icon={CircleAlert} title={t('failedToLoadBills')}>
          <Button variant='outline' className='rounded-full' onClick={live.retry}>
            {t('retry')}
          </Button>
        </Empty>
      ) : !hasLiveBill(live) && live.closed.length === 0 && live.turnedDown.length === 0 ? (
        <Empty icon={ReceiptText} title={t('noBillsYet')} />
      ) : (
        <Rise className='flex flex-col gap-5'>
          {hasLiveBill(live) && (
            <RiseItem>
              <OpenBills live={live} />
            </RiseItem>
          )}
          {live.turnedDown.length > 0 && (
            <RiseItem>
              <OrderGroup title={t('statusCancelled')} orders={live.turnedDown} />
            </RiseItem>
          )}
          <OnYourTab />
          {live.closed.length > 0 && (
            <RiseItem>
              <BillsByMonth bills={live.closed} ordersById={live.ordersById} />
            </RiseItem>
          )}
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
 * What the customer owes the business, as the till decided it: the balance of
 * their tab in Accounts, where a settled share lands when the cashier puts
 * it on account. No sum of the open bills: the app cannot know their part
 * of an unsettled room's time, so it does not guess one. Only for an
 * account that owes; a tap opens the tab.
 */
function OnYourTab() {
  const t = useT()
  const price = usePrice()
  const auth = useAuth()
  const features = useFeatures()
  const accountQuery = useQuery({ ...getMyAccountOptions(), enabled: auth.isAuthenticated && features.tabs, retry: false })
  const balance = accountQuery.isError ? 0 : Number(accountQuery.data?.balance ?? 0)
  if (!features.tabs || balance <= 0) return null
  return (
    <RiseItem>
      <TileGroup>
        <TileLink
          to='/account'
          icon={Wallet}
          label={t('onYourTab')}
          value={<span className='text-destructive text-body font-bold tabular-nums'>{price(balance)}</span>}
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
