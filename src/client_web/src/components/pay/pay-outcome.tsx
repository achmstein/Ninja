import { type ComponentType, type ReactNode } from 'react'
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { CircleAlert, Clock, CreditCard, Loader2 } from 'lucide-react'
import { type PaymentStatusView } from '@/api/sales'
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
import { SuccessBurst } from '@/components/pay/success-burst'

/**
 * The page a payment comes back to, and an order waiting for its payment ahead: one slab under the
 * business's mark, its state drawn in place (a spinner, the drawn tick, a warning), what was paid
 * rolling in under it, and the way on beneath (routes/pay).
 */
export type OutcomeState = 'waiting' | 'waited' | 'muted' | 'due' | 'good' | 'bad'

const MARK: Record<OutcomeState, { icon: ComponentType<{ className?: string }> | null; tone: string }> = {
  waiting: { icon: Loader2, tone: 'bg-background/10' },
  waited: { icon: Clock, tone: 'bg-background/10' },
  muted: { icon: CircleAlert, tone: 'bg-background/10' },
  // An order waiting for its payment ahead
  due: { icon: CreditCard, tone: 'bg-amber-400 text-black' },
  // The tick is drawn, not an icon
  good: { icon: null, tone: 'bg-emerald-500 text-white' },
  bad: { icon: CircleAlert, tone: 'bg-destructive text-white' },
}

/**
 * The one slab the page is about, which stays put while what it says
 * changes: the spinner while the provider's word is awaited becomes the
 * drawn tick (or the warning) in place, and the title sharpens in with it.
 * What was charged rolls in under a paid one (with the online fee in it,
 * where there was one), under the business's own mark.
 */
export function Outcome({
  state,
  title,
  note,
  amount,
  payment,
  children,
}: {
  state: OutcomeState
  title: string
  note?: string
  /** What the card paid, on a paid one */
  amount?: string
  /** Under the amount: the online fee in it, where there was one */
  payment?: Pick<PaymentStatusView, 'fee' | 'currency'>
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
          {/* Whose payment it was: the business's own mark over it */}
          <RiseItem className='flex justify-center pb-2'>
            <BusinessMark />
          </RiseItem>
          <RiseItem>
            {/* A paid one's burst flies past the slab's edge rather than being cut off by it */}
            <Slab
              layout
              transition={springSoft}
              className={cn('flex flex-col items-center gap-4 px-6 py-9 text-center', state === 'good' && 'overflow-visible')}
            >
              <div className='relative grid place-items-center'>
                {/* A paid one lands with a burst round its tick */}
                {state === 'good' && <SuccessBurst />}
                <AnimatePresence mode='popLayout' initial={false}>
                  <motion.div
                    key={state}
                    {...swap}
                    // The tick's circle pops as it lands, a spring's overshoot and back
                    animate={state === 'good' && !reduced ? { ...swap.animate, scale: [0.6, 1.12, 1] } : swap.animate}
                    transition={state === 'good' && !reduced ? { scale: { duration: 0.5, times: [0, 0.6, 1] } } : undefined}
                    className={cn('relative grid size-20 place-items-center rounded-full', tone)}
                  >
                    {Icon ? (
                      <Icon className={cn('size-9', state === 'waiting' && 'animate-spin motion-reduce:animate-none')} />
                    ) : (
                      <DrawnCheck reduced={!!reduced} className='size-10' />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.div key={title} {...swap} className='flex flex-col items-center gap-1.5'>
                  <h1 className='heading text-title leading-tight' aria-live='polite'>
                    {title}
                  </h1>
                  {note && <p className='text-muted-foreground text-note'>{note}</p>}
                </motion.div>
              </AnimatePresence>
              {amount && <Odometer value={amount} className='text-display font-extrabold' />}
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

/** The business's logo, or its mark and name where it has no wordmark */
export function BusinessMark() {
  const wordmark = useBrandWordmark()
  const name = useBrandName()
  return wordmark ? (
    <BrandWordmark className='h-12 max-w-[60vw]' />
  ) : (
    <span className='flex flex-col items-center gap-2'>
      <BrandMark className='size-14 rounded-2xl text-2xl' />
      <span className='text-note font-bold'>{name}</span>
    </span>
  )
}

/** "Includes 3.00 EGP online payment fee" */
export function FeeNote({ payment }: { payment: Pick<PaymentStatusView, 'fee' | 'currency'> }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  return (
    <p className='text-muted-foreground -mt-2 text-caption tabular-nums'>
      {t('onlinePaymentFee')} · {formatMoney(payment.fee, payment.currency, language)}
    </p>
  )
}

