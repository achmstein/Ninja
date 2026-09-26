import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleAlert, CircleCheck, Clock, Loader2 } from 'lucide-react'
import { type PaymentStatusView } from '@/api/sales'
import { getOnlinePaymentOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatMoney } from '@/lib/currency'
import { useLanguage, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/pay/$key')({
  component: PayReturnPage,
})

/** How long the page waits on the provider's word before it stops asking. */
const GIVE_UP_MS = 120_000
const POLL_MS = 2_000

/**
 * Where the provider's checkout sends the guest back to (/pay/{key}). The
 * trip back proves nothing — anyone can type the address — so the page
 * asks Sales until the provider's signed callback has settled the payment
 * one way or the other, then shows the receipt or the way back to try
 * again. Past two minutes it stops asking and says the bill will tell.
 */
function PayReturnPage() {
  const { key } = Route.useParams()
  const t = useT()
  const queryClient = useQueryClient()
  const [gaveUp, setGaveUp] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setGaveUp(true), GIVE_UP_MS)
    return () => clearTimeout(timer)
  }, [])

  const query = useQuery({
    ...getOnlinePaymentOptions({
      path: { key },
      query: { 'api-version': API_VERSION },
    }),
    retry: 2,
    refetchInterval: (q) =>
      !gaveUp && (q.state.data == null || q.state.data.status === 'Pending')
        ? POLL_MS
        : false,
  })
  const payment = query.data
  const status = payment?.status

  // The bill has moved on: the bills page and any open pay sheet read it again
  useEffect(() => {
    if (status && status !== 'Pending') {
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyBills' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getBillToPay' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlaceBillToPay' }] })
    }
  }, [status, queryClient])

  if (query.isError && !payment) {
    return (
      <Outcome icon={CircleAlert} tone='muted' title={t('paymentNotFound')}>
        <BackToBills />
      </Outcome>
    )
  }

  if (!payment || status === 'Pending') {
    return gaveUp ? (
      <Outcome icon={Clock} tone='muted' title={t('paymentStillConfirming')}>
        <BackToBills />
      </Outcome>
    ) : (
      <Outcome icon={Loader2} tone='spin' title={t('confirmingPayment')} />
    )
  }

  if (status === 'Paid') {
    return (
      <Outcome icon={CircleCheck} tone='good' title={t('paymentPaid')}>
        <p className='text-muted-foreground -mt-2 text-sm'>{t('paymentPaidThanks')}</p>
        <Receipt payment={payment} />
        {payment.billClosed && (
          <p className='text-muted-foreground text-sm'>{t('billClosedNote')}</p>
        )}
        <BackToBills />
      </Outcome>
    )
  }

  return (
    <Outcome
      icon={CircleAlert}
      tone='bad'
      title={t(
        status === 'Expired'
          ? 'paymentExpired'
          : status === 'Refunded'
            ? 'paymentRefunded'
            : 'paymentFailed'
      )}
    >
      {payment.failureReason && (
        <p className='text-muted-foreground -mt-2 text-sm'>{payment.failureReason}</p>
      )}
      {status !== 'Refunded' && !payment.billClosed && (
        <Button asChild size='lg' className='w-full rounded-pill font-bold'>
          <Link to='/bills' search={{ pay: Number(payment.ticketId) }} replace>
            {t('tryAgain')}
          </Link>
        </Button>
      )}
      <BackToBills />
    </Outcome>
  )
}

const TONES = {
  spin: 'text-primary animate-spin',
  good: 'text-green-600 dark:text-green-500',
  bad: 'text-destructive',
  muted: 'text-muted-foreground',
} as const

function Outcome({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof TONES
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className='mx-auto flex min-h-[70svh] w-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center'>
      <Icon className={`h-14 w-14 ${TONES[tone]}`} />
      <h1 className='text-xl font-bold' aria-live='polite'>
        {title}
      </h1>
      {children}
    </div>
  )
}

/** The payment as a slip: the share, the tip, the fee, what the card paid. */
function Receipt({ payment }: { payment: PaymentStatusView }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const money = (value: number | string) => formatMoney(value, payment.currency, language)
  const tip = Number(payment.tip)
  const fee = Number(payment.fee)
  const row = 'flex items-baseline justify-between gap-2 tabular-nums'

  return (
    <div className='bg-muted/50 flex w-full flex-col gap-1.5 rounded-xl border border-dashed p-4 text-sm'>
      <div className={`${row} text-muted-foreground`}>
        <span>{t('yourShare')}</span>
        <span>{money(payment.amount)}</span>
      </div>
      {tip > 0 && (
        <div className={`${row} text-muted-foreground`}>
          <span>{t('tip')}</span>
          <span>{money(tip)}</span>
        </div>
      )}
      {fee > 0 && (
        <div className={`${row} text-muted-foreground`}>
          <span>{t('onlinePaymentFee')}</span>
          <span>{money(fee)}</span>
        </div>
      )}
      <div className={`${row} border-t pt-2 text-base font-bold`}>
        <span>{t('charged')}</span>
        <span>{money(payment.charged)}</span>
      </div>
    </div>
  )
}

function BackToBills() {
  const t = useT()
  return (
    <Button asChild size='lg' variant='outline' className='w-full rounded-pill font-bold'>
      <Link to='/bills'>{t('backToBills')}</Link>
    </Button>
  )
}
