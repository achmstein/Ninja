import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { getOnlinePaymentOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrandName } from '@/lib/brand'
import { formatMoney } from '@/lib/currency'
import { useLanguage, useT } from '@/lib/i18n'
import { DemoCheckout } from '@/components/pay/demo-checkout'
import { Outcome } from '@/components/pay/pay-outcome'
import { markAfterPayment, useBackTo } from '@/lib/back-to'

export const Route = createFileRoute('/pay/$key')({
  // simulate: a demo business's pretend checkout, which is this page itself
  validateSearch: (search: Record<string, unknown>): { simulate?: boolean } =>
    search.simulate === 1 || search.simulate === '1' || search.simulate === true ? { simulate: true } : {},
  component: PayReturnPage,
})

/** How long the page waits on the provider's word before it stops asking. */
const GIVE_UP_MS = 120_000
const POLL_MS = 2_000

/**
 * Where the provider's checkout sends the guest back to (/pay/{key}). The
 * trip back proves nothing (anyone can type the address), so the page
 * asks Sales until the provider's signed callback has settled the payment
 * one way or the other (Sales asks the provider itself when the callback is
 * late), then shows the receipt or the way back to try again. Past two
 * minutes it stops asking and says the bill will tell. A share of a bill goes
 * back to the bills; an order paid ahead goes on to the menu, where the dock
 * follows it, or back to paying it.
 */
function PayReturnPage() {
  const { key } = Route.useParams()
  const { simulate } = Route.useSearch()
  const t = useT()
  const language = useLanguage((s) => s.language)
  const business = useBrandName()
  const queryClient = useQueryClient()
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [])

  const query = useQuery({
    ...getOnlinePaymentOptions({ path: { key }, query: { 'api-version': API_VERSION } }),
    retry: 2,
    refetchInterval: (q) => (!gaveUp && (q.state.data == null || q.state.data.status === 'Pending') ? POLL_MS : false),
  })
  const payment = query.data
  const status = payment?.status
  const orderId = payment?.orderId != null ? Number(payment.orderId) : null

  // Once the payment is settled, the browser's back goes to the menu: behind this page is only the provider's checkout
  useBackTo('/', !!status && status !== 'Pending')

  // The bill (or the order) has moved on: what shows it reads it again
  useEffect(() => {
    if (status && status !== 'Pending') {
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyBills' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getBillToPay' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlaceBillToPay' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrderToPay' }] })
    }
  }, [status, queryClient])

  const back = orderId != null ? <BackToMenu /> : <BackToBills />

  if (query.isError && !payment) {
    return (
      <Outcome state='muted' title={t('paymentNotFound')}>
        <BackToBills />
      </Outcome>
    )
  }

  // A demo business takes pretend payments: the guest says how the payment went
  if (simulate && payment && status === 'Pending') {
    return <DemoCheckout payment={payment} />
  }

  if (!payment || status === 'Pending') {
    return gaveUp ? (
      <Outcome state='waited' title={t('paymentStillConfirming')}>
        {back}
      </Outcome>
    ) : (
      <Outcome state='waiting' title={t('confirmingPayment')} />
    )
  }

  // Held (a card, charged once the branch accepts) or taken: the order is with the business now
  if (status === 'Paid' || status === 'Authorized') {
    return (
      <Outcome
        state='good'
        title={t('paymentPaid')}
        note={
          orderId != null
            ? t(status === 'Authorized' ? 'payAheadHeldNote' : 'payAheadPaidNote', { name: business })
            : t('paymentPaidThanks')
        }
        amount={formatMoney(payment.charged, payment.currency, language)}
        payment={payment}
      >
        {orderId == null && payment.billClosed && <p className='text-muted-foreground px-2 text-center text-note'>{t('billClosedNote')}</p>}
        {orderId != null ? <FollowOrder /> : <BackToBills />}
      </Outcome>
    )
  }

  return (
    <Outcome state='bad' title={t(failedTitle(status))} note={payment.failureReason ?? undefined}>
      {orderId != null ? (
        // The order still waits for its payment, until its time runs out: pay it again from its page
        status !== 'Refunded' &&
        status !== 'Voided' && (
          <Link
            to='/pay/order/$orderId'
            params={{ orderId: String(orderId) }}
            replace
            className='bg-primary text-primary-foreground flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'
          >
            {t('tryAgain')}
          </Link>
        )
      ) : (
        status !== 'Refunded' &&
        !payment.billClosed && (
          <Link
            to='/bills'
            search={{ pay: Number(payment.ticketId) }}
            replace
            className='bg-primary text-primary-foreground flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'
          >
            {t('tryAgain')}
          </Link>
        )
      )}
      {back}
    </Outcome>
  )
}

function failedTitle(status: string | undefined) {
  switch (status) {
    case 'Expired':
      return 'paymentExpired' as const
    case 'Refunded':
      return 'paymentRefunded' as const
    case 'Voided':
      return 'paymentReleased' as const
    default:
      return 'paymentFailed' as const
  }
}

const SECONDARY = 'bg-muted flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'

/**
 * To the bills, in this page's place: back from the bills then goes to the menu (useBackTo), not to this page
 * again and not to the provider's checkout behind it.
 */
function BackToBills() {
  const t = useT()
  return (
    <Link to='/bills' replace onClick={markAfterPayment} className={SECONDARY}>
      {t('backToBills')}
    </Link>
  )
}

/** To the menu, where the dock follows the order from here */
function FollowOrder() {
  const t = useT()
  return (
    <Link
      to='/'
      replace
      className='bg-primary text-primary-foreground flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'
    >
      {t('payAheadFollow')}
    </Link>
  )
}

function BackToMenu() {
  const t = useT()
  return (
    <Link to='/' replace className={SECONDARY}>
      {t('backToMenu')}
    </Link>
  )
}
