import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { type PayShareView, type PayView } from '@/api/sales'
import { cancelOnlinePaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { springSoft } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { usePrice, useT, type TranslationKey } from '@/lib/i18n'
import { type PayWhy as Why } from '@/lib/pay'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'

const num = (value: number | string | null | undefined) => Number(value ?? 0) || 0

const WHY_KEY: Record<Why, TranslationKey> = {
  off: 'payWhyOff',
  'not-set-up': 'payWhyNotSetUp',
  closed: 'payWhyClosed',
  'clock-running': 'payWhyClockRunning',
  empty: 'payWhyEmpty',
  paid: 'payWhyPaid',
  'being-paid': 'payWhyBeingPaid',
}

/**
 * What is left to pay, rolling to each new sum, and paid so far, over a
 * bar of the bill that fills as shares land: paid in green, in someone's
 * checkout right now in amber on top of it. What every guest at the table
 * watches fill. `hero` is the big one, on the pay sheet's slab; without
 * it, the line under a bill.
 */
export function PaidSoFar({ view, hero = false, className }: { view: PayView; hero?: boolean; className?: string }) {
  const t = useT()
  const price = usePrice()
  const total = num(view.total)
  const paid = num(view.paid)
  const held = num(view.held)
  const share = (v: number) => (total > 0 ? Math.min(1, v / total) : 0)

  return (
    <div className={cn('flex flex-col', hero ? 'gap-3' : 'gap-2', className)}>
      <div className='flex items-end justify-between gap-2 tabular-nums'>
        <div className='flex min-w-0 flex-col'>
          <span className='text-muted-foreground text-caption font-semibold'>{t('remainingToPay')}</span>
          {/* 30px and 15px type: wheels a whole 36 and 18 px tall, so no edge of the next digit shows */}
          <Odometer value={price(view.remaining)} className={cn('font-extrabold', hero ? 'text-display' : 'text-body')} />
        </div>
        <div className='flex flex-col items-end'>
          <span className='text-muted-foreground text-caption font-semibold'>{t('paidSoFar')}</span>
          <Odometer value={price(paid)} className='text-body font-semibold text-emerald-500' />
        </div>
      </div>
      <div className={cn('bg-muted relative overflow-hidden rounded-full', hero ? 'h-3' : 'h-2')}>
        {/* Scaled, never resized: the bar fills with a transform, from the start edge */}
        <motion.div
          className='absolute inset-0 origin-left bg-amber-400 rtl:origin-right'
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share(paid + held) }}
          transition={springSoft}
        />
        <motion.div
          className='absolute inset-0 origin-left bg-emerald-500 rtl:origin-right'
          initial={{ scaleX: 0 }}
          animate={{ scaleX: share(paid) }}
          transition={springSoft}
        />
      </div>
    </div>
  )
}

/**
 * Who has paid what, and who is paying right now; the guest's own as "You".
 * A checkout of their own left unfinished (the page closed without paying
 * or declining) holds its share until it runs out; they can go back to it
 * (a demo's checkout is ours to reopen) or cancel it, freeing it at once.
 * Each share lands with a small pop, and its mark turns from the spinner
 * to the tick in place when it goes through.
 */
export function SharesList({ shares, simulated = false }: { shares: PayShareView[]; simulated?: boolean }) {
  const t = useT()
  const price = usePrice()
  const queryClient = useQueryClient()
  const cancel = useMutation({
    ...cancelOnlinePaymentMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getBillToPay' }] })
      void queryClient.invalidateQueries({ queryKey: [{ _id: 'getPlaceBillToPay' }] })
    },
    onError: () => toast.error(t('cancelPaymentFailed')),
  })
  if (shares.length === 0) return null

  return (
    <ul className='flex flex-col gap-2'>
      <AnimatePresence initial={false}>
        {shares.map((share, i) => {
          const paid = share.status === 'Paid'
          return (
            <motion.li
              key={share.key ?? i}
              layout='position'
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={springSoft}
              className='flex items-center gap-2.5 text-note'
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full transition-colors duration-250',
                  paid ? 'bg-emerald-500 text-white' : 'bg-amber-400/20 text-amber-500'
                )}
              >
                <AnimatePresence mode='popLayout' initial={false}>
                  <motion.span
                    key={paid ? 'paid' : 'paying'}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={springSoft}
                    className='grid place-items-center'
                  >
                    {paid ? <Check className='size-3.5' strokeWidth={3} /> : <Loader2 className='size-3.5 animate-spin motion-reduce:animate-none' />}
                  </motion.span>
                </AnimatePresence>
              </span>
              <span className='min-w-0 flex-1 truncate font-medium'>
                {share.isMine ? t('you') : share.payerName || t('payerGuest')}
                {!paid && <span className='text-muted-foreground font-normal'> · {t('shareBeingPaid')}</span>}
              </span>
              <span className='shrink-0 font-semibold tabular-nums'>{price(share.amount)}</span>
              {share.isMine && !paid && share.key && (
                <span className='flex shrink-0 gap-1'>
                  {simulated && (
                    <Link
                      to='/pay/$key'
                      params={{ key: String(share.key).replace(/-/g, '') }}
                      search={{ simulate: true }}
                      className='bg-muted flex h-7 items-center rounded-full px-2.5 text-caption font-semibold'
                    >
                      {t('continuePayment')}
                    </Link>
                  )}
                  <button
                    type='button'
                    className='text-destructive flex h-7 items-center rounded-full px-2.5 text-caption font-semibold disabled:opacity-50'
                    disabled={cancel.isPending}
                    onClick={() => cancel.mutate({ path: { key: String(share.key) }, query: { 'api-version': API_VERSION } })}
                  >
                    {t('cancelPayment')}
                  </button>
                </span>
              )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}

/** Why the bill cannot be paid now, in a line. */
export function PayWhy({ why, className }: { why: string | null; className?: string }) {
  const t = useT()
  const key = why ? WHY_KEY[why as Why] : undefined
  if (!key) return null
  const done = why === 'paid'
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-2xl px-4 py-3 text-caption font-medium',
        done ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {done ? <Check className='size-4 shrink-0' /> : <CircleAlert className='size-4 shrink-0' />}
      {t(key)}
    </div>
  )
}
