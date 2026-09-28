import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { CircleAlert, Clock, Loader2 } from 'lucide-react'
import { type PaymentStatusView } from '@/api/sales'
import { getOnlinePaymentOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatMoney } from '@/lib/currency'
import { useLanguage, useT } from '@/lib/i18n'
import { blurSwap, springSoft } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { BrandMark, BrandWordmark } from '@/components/brand/brand-mark'
import { useBrandName, useBrandWordmark } from '@/lib/brand'
import { DrawnCheck } from '@/components/motion/morph-button'
import { Odometer } from '@/components/ninja/odometer'
import { Rise, RiseItem } from '@/components/ninja/page/page'
import { Slab } from '@/components/ninja/page/parts'
import { DemoCheckout } from '@/components/pay/demo-checkout'

export const Route = createFileRoute('/pay/$key')({
  // simulate: a demo café's pretend checkout, which is this page itself
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
 * one way or the other, then shows the receipt or the way back to try
 * again. Past two minutes it stops asking and says the bill will tell.
 */
function PayReturnPage() {
  const { key } = Route.useParams()
  const { simulate } = Route.useSearch()
  const t = useT()
  const language = useLanguage((s) => s.language)
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
      <Outcome state='muted' title={t('paymentNotFound')}>
        <BackToBills />
      </Outcome>
    )
  }

  // A demo café takes pretend payments: the guest says how the payment went
  if (simulate && payment && status === 'Pending') {
    return <DemoCheckout payment={payment} />
  }

  if (!payment || status === 'Pending') {
    return gaveUp ? (
      <Outcome state='waited' title={t('paymentStillConfirming')}>
        <BackToBills />
      </Outcome>
    ) : (
      <Outcome state='waiting' title={t('confirmingPayment')} />
    )
  }

  if (status === 'Paid') {
    return (
      <Outcome
        state='good'
        title={t('paymentPaid')}
        note={t('paymentPaidThanks')}
        amount={formatMoney(payment.charged, payment.currency, language)}
        payment={payment}
      >
        {payment.billClosed && <p className='text-muted-foreground px-2 text-center text-sm'>{t('billClosedNote')}</p>}
        <BackToBills />
      </Outcome>
    )
  }

  return (
    <Outcome
      state='bad'
      title={t(status === 'Expired' ? 'paymentExpired' : status === 'Refunded' ? 'paymentRefunded' : 'paymentFailed')}
      note={payment.failureReason ?? undefined}
    >
      {status !== 'Refunded' && !payment.billClosed && (
        <Link
          to='/bills'
          search={{ pay: Number(payment.ticketId) }}
          replace
          className='bg-primary text-primary-foreground flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-bold'
        >
          {t('tryAgain')}
        </Link>
      )}
      <BackToBills />
    </Outcome>
  )
}

type State = 'waiting' | 'waited' | 'muted' | 'good' | 'bad'

const MARK: Record<State, { icon: ComponentType<{ className?: string }> | null; tone: string }> = {
  waiting: { icon: Loader2, tone: 'bg-background/10' },
  waited: { icon: Clock, tone: 'bg-background/10' },
  muted: { icon: CircleAlert, tone: 'bg-background/10' },
  // The tick is drawn, not an icon
  good: { icon: null, tone: 'bg-emerald-500 text-white' },
  bad: { icon: CircleAlert, tone: 'bg-destructive text-white' },
}

/**
 * The one slab the page is about, which stays put while what it says
 * changes: the spinner while the provider's word is awaited becomes the
 * drawn tick (or the warning) in place, and the title sharpens in with it.
 * What was charged rolls in under a paid one (with the online fee in it,
 * where there was one), under the café's own mark.
 */
function Outcome({
  state,
  title,
  note,
  amount,
  payment,
  children,
}: {
  state: State
  title: string
  note?: string
  /** What the card paid, on a paid one */
  amount?: string
  payment?: PaymentStatusView
  children?: ReactNode
}) {
  const reduced = useReducedMotion()
  const swap = blurSwap(reduced)
  const { icon: Icon, tone } = MARK[state]

  return (
    <MotionConfig reducedMotion='user'>
      {/* No dock on this page: -mb cancels the root <main>'s clearance for it */}
      <div className='mx-auto -mb-[calc(5rem+env(safe-area-inset-bottom))] flex min-h-[calc(100svh-env(safe-area-inset-top))] w-full max-w-lg flex-col justify-center px-4 py-8'>
        <Rise className='flex flex-col gap-4'>
          {/* Whose payment it was: the café's own mark over it */}
          <RiseItem className='flex justify-center pb-2'>
            <CafeMark />
          </RiseItem>
          <RiseItem>
            <Slab layout transition={springSoft} className='flex flex-col items-center gap-4 px-6 py-9 text-center'>
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.div key={state} {...swap} className={cn('grid size-20 place-items-center rounded-full', tone)}>
                  {Icon ? (
                    <Icon className={cn('size-9', state === 'waiting' && 'animate-spin motion-reduce:animate-none')} />
                  ) : (
                    <DrawnCheck reduced={!!reduced} className='size-10' />
                  )}
                </motion.div>
              </AnimatePresence>
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.div key={title} {...swap} className='flex flex-col items-center gap-1.5'>
                  <h1 className='heading text-[calc(1.5rem*var(--heading-scale))] leading-tight' aria-live='polite'>
                    {title}
                  </h1>
                  {note && <p className='text-muted-foreground text-sm'>{note}</p>}
                </motion.div>
              </AnimatePresence>
              {amount && <Odometer value={amount} className='text-[30px] font-extrabold' />}
              {/* What the card paid over the share, said once rather than printed as a slip */}
              {payment && Number(payment.fee) > 0 && <FeeNote payment={payment} />}
            </Slab>
          </RiseItem>
          {children && <RiseItem className='flex flex-col gap-2'>{children}</RiseItem>}
        </Rise>
      </div>
    </MotionConfig>
  )
}

/** The café's logo, or its mark and name where it has no wordmark */
function CafeMark() {
  const wordmark = useBrandWordmark()
  const name = useBrandName()
  return wordmark ? (
    <BrandWordmark className='h-12 max-w-[60vw]' />
  ) : (
    <span className='flex flex-col items-center gap-2'>
      <BrandMark className='size-14 rounded-2xl text-2xl' />
      <span className='text-sm font-bold'>{name}</span>
    </span>
  )
}

/** "Includes 3.00 EGP online payment fee" */
function FeeNote({ payment }: { payment: PaymentStatusView }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  return (
    <p className='text-muted-foreground -mt-2 text-xs tabular-nums'>
      {t('onlinePaymentFee')} · {formatMoney(payment.fee, payment.currency, language)}
    </p>
  )
}

function BackToBills() {
  const t = useT()
  return (
    <Link to='/bills' className='bg-muted flex h-[52px] w-full items-center justify-center rounded-full text-[15px] font-bold'>
      {t('backToBills')}
    </Link>
  )
}
