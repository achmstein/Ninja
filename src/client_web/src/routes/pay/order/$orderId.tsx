import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { isAxiosError } from 'axios'
import { useAuth } from 'react-oidc-context'
import { cancelUnpaidOrderMutation } from '@/api/ordering/@tanstack/react-query.gen'
import { getOrderToPayOptions, startOrderPaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrandName } from '@/lib/brand'
import { formatClock, useSecondTick } from '@/lib/clock'
import { formatMoney } from '@/lib/currency'
import { useLanguage, useT } from '@/lib/i18n'
import { problemMessage } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { useGuestStore } from '@/stores/guest-store'
import { Outcome } from '@/components/pay/pay-outcome'

export const Route = createFileRoute('/pay/order/$orderId')({
  // start: just placed, so straight on to paying it, with nothing to press
  validateSearch: (search: Record<string, unknown>): { start?: boolean } =>
    search.start === 1 || search.start === '1' || search.start === true ? { start: true } : {},
  component: PayOrderPage,
})

/** Sales hears of a new order a moment after it is placed: asked again this often, for this long */
const POLL_MS = 1_500
const GIVE_UP_MS = 30_000

/**
 * An order paid ahead online, while it waits for its payment (a delivery or an
 * order to collect; lib/pay-ahead.ts). Just placed, it goes straight on to the
 * provider's checkout once Sales has it priced; come back to (the dock's Pay
 * now, a checkout that failed), it says what it comes to and how long is left,
 * with Pay and the way to cancel it. Paid, it is with the business and the dock
 * follows it; let go, nothing was charged.
 */
function PayOrderPage() {
  const { orderId } = Route.useParams()
  const { start } = Route.useSearch()
  const id = Number(orderId)
  const t = useT()
  const language = useLanguage((s) => s.language)
  const business = useBrandName()
  const auth = useAuth()
  const contact = useGuestStore((s) => s.contact)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [gaveUp, setGaveUp] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [])

  const options = getOrderToPayOptions({ path: { orderId: id }, query: { 'api-version': API_VERSION } })
  const query = useQuery({
    ...options,
    // 404 until Sales has heard of it: asked again rather than given up on
    retry: (count, error) => !gaveUp && isAxiosError(error) && error.response?.status === 404 && count < GIVE_UP_MS / POLL_MS,
    retryDelay: POLL_MS,
    // While it waits, its time and the provider's word can change it
    refetchInterval: (q) => (q.state.data?.status === 'Due' ? 10_000 : false),
  })
  const order = query.data
  const due = order?.status === 'Due'

  const pay = useMutation({
    ...startOrderPaymentMutation(),
    // Off to the provider's checkout (or a demo's own page); the page comes back to /pay/{key}
    onSuccess: (started) => window.location.assign(started.checkoutUrl),
    onError: (error) => {
      toast.error(problemMessage(error, t, 'payAheadStartFailed'))
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
    },
  })
  const startPaying = () =>
    pay.mutate({
      path: { orderId: id },
      query: { 'api-version': API_VERSION },
      // A guest's name and phone, as given at the checkout; a signed-in customer is known from the token
      body: auth.isAuthenticated ? {} : { payerName: contact?.name ?? null, payerPhone: contact?.phone ?? null },
    })

  // Just placed: on to paying at once, once
  useEffect(() => {
    if (!start || !due || autoStarted.current) return
    autoStarted.current = true
    startPaying()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, due])

  const cancel = useMutation({
    ...cancelUnpaidOrderMutation(),
    onSuccess: () => {
      toast.success(t('payAheadCancelled'))
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      void navigate({ to: '/', replace: true })
    },
    onError: (error) => {
      toast.error(problemMessage(error, t, 'payAheadCancelFailed'))
      void queryClient.invalidateQueries({ queryKey: options.queryKey })
    },
  })

  const now = useSecondTick(due)
  const left = order ? Math.max(0, (Date.parse(order.dueBy) - now) / 1000) : 0

  if (!order) {
    return query.isError && (gaveUp || !(isAxiosError(query.error) && query.error.response?.status === 404)) ? (
      <Outcome state='muted' title={t('payAheadNotFound')}>
        <BackToMenu />
      </Outcome>
    ) : (
      <Outcome state='waiting' title={t('payAheadGettingReady')} />
    )
  }

  if (order.status === 'Paid') {
    return (
      <Outcome state='good' title={t('paymentPaid')} note={t('payAheadPaidNote', { name: business })}>
        <Link to='/' replace className={PRIMARY}>
          {t('payAheadFollow')}
        </Link>
      </Outcome>
    )
  }

  if (!due) {
    return (
      <Outcome state='muted' title={t('payAheadOrderCancelled')} note={t('payAheadNothingCharged')}>
        <BackToMenu />
      </Outcome>
    )
  }

  // On its way to the checkout
  if (pay.isPending || pay.isSuccess) return <Outcome state='waiting' title={t('payAheadToCheckout')} />

  const outOfTime = left <= 0
  return (
    <Outcome
      state='due'
      title={t('payAheadTitle')}
      note={outOfTime ? t('payAheadOutOfTime') : t('payAheadWithin', { time: formatClock(left), name: business })}
      amount={formatMoney(order.charged, order.currency, language)}
      payment={order}
    >
      {order.holdsCards && <p className='text-muted-foreground px-2 text-center text-note'>{t('payAheadHeld', { name: business })}</p>}
      <button type='button' onClick={startPaying} disabled={outOfTime} className={`${PRIMARY} disabled:opacity-50`}>
        {t('payAheadPay', { amount: formatMoney(order.charged, order.currency, language) })}
      </button>
      <button
        type='button'
        onClick={() => cancel.mutate({ path: { orderId: id }, query: { 'api-version': API_VERSION } })}
        disabled={cancel.isPending}
        className={SECONDARY}
      >
        {t('payAheadCancel')}
      </button>
    </Outcome>
  )
}

const PRIMARY = 'bg-primary text-primary-foreground flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'
const SECONDARY = 'bg-muted flex h-[52px] w-full items-center justify-center rounded-full text-body font-bold'

function BackToMenu() {
  const t = useT()
  return (
    <Link to='/' replace className={SECONDARY}>
      {t('backToMenu')}
    </Link>
  )
}
