import { Check, CircleAlert, Loader2 } from 'lucide-react'
import { type PayShareView, type PayView } from '@/api/sales'
import { usePrice, useT, type TranslationKey } from '@/lib/i18n'
import { type PayWhy as Why } from '@/lib/pay'
import { cn } from '@/lib/utils'

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
 * Paid so far and what is left, over a bar of the bill: paid, in someone's
 * checkout right now, and left. What every guest at the table watches fill.
 */
export function PaidSoFar({ view, className }: { view: PayView; className?: string }) {
  const t = useT()
  const price = usePrice()
  const total = num(view.total)
  const paid = num(view.paid)
  const held = num(view.held)
  const pct = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className='flex items-end justify-between gap-2 tabular-nums'>
        <div className='flex flex-col'>
          <span className='text-muted-foreground text-xs'>{t('paidSoFar')}</span>
          <span className='text-[15px] font-semibold'>{price(paid)}</span>
        </div>
        <div className='flex flex-col items-end'>
          <span className='text-muted-foreground text-xs'>{t('remainingToPay')}</span>
          <span className='text-lg font-bold'>{price(view.remaining)}</span>
        </div>
      </div>
      <div className='bg-muted flex h-2 overflow-hidden rounded-full'>
        <div
          className='h-full bg-green-600 transition-[width] duration-500 dark:bg-green-500'
          style={{ width: `${pct(paid)}%` }}
        />
        <div
          className='bg-primary/50 h-full transition-[width] duration-500'
          style={{ width: `${pct(held)}%` }}
        />
      </div>
    </div>
  )
}

/** Who has paid what, and who is paying right now; the guest's own as "You". */
export function SharesList({ shares }: { shares: PayShareView[] }) {
  const t = useT()
  const price = usePrice()
  if (shares.length === 0) return null

  return (
    <ul className='flex flex-col gap-1.5'>
      {shares.map((share, i) => {
        const paid = share.status === 'Paid'
        return (
          <li key={i} className='flex items-center gap-2 text-sm'>
            <span
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full',
                paid
                  ? 'bg-green-600/15 text-green-700 dark:text-green-400'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {paid ? (
                <Check className='h-3 w-3' />
              ) : (
                <Loader2 className='h-3 w-3 animate-spin' />
              )}
            </span>
            <span className='min-w-0 flex-1 truncate'>
              {share.isMine ? t('you') : share.payerName || t('payerGuest')}
              {!paid && (
                <span className='text-muted-foreground'> · {t('shareBeingPaid')}</span>
              )}
            </span>
            <span className='shrink-0 tabular-nums'>{price(share.amount)}</span>
          </li>
        )
      })}
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
        'flex items-center gap-2 rounded-lg p-3 text-[13px]',
        done
          ? 'bg-green-600/10 text-green-700 dark:text-green-400'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {done ? (
        <Check className='h-4 w-4 shrink-0' />
      ) : (
        <CircleAlert className='h-4 w-4 shrink-0' />
      )}
      {t(key)}
    </div>
  )
}
