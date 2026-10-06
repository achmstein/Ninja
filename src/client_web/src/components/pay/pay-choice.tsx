import { type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { Banknote, CreditCard } from 'lucide-react'
import { useBrandName } from '@/lib/brand'
import { usePrice, useT } from '@/lib/i18n'
import type { PayAhead, PayMethod } from '@/lib/pay-ahead'
import { cn } from '@/lib/utils'

const SPRING = { type: 'spring', stiffness: 420, damping: 40 } as const

/**
 * In the open order, where the business takes payment ahead and the order
 * goes to a door or the counter: pay online now, or in cash (to the rider, or
 * at the counter). Online, one quiet line says what matters and nothing else:
 * the fee the customer carries, where there is one, and that a card is only
 * charged once the branch accepts the order, where it is held.
 */
export function PayChoice({ payAhead, delivering, fee }: { payAhead: PayAhead; delivering: boolean; fee: number }) {
  const t = useT()
  const price = usePrice()
  const business = useBrandName()
  const methods: PayMethod[] = ['online', 'cash']
  const current: PayMethod = payAhead.online ? 'online' : 'cash'

  // A radio group, as the pickup and delivery one is: one Tab stop, the arrows move and choose
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next: PayMethod = current === 'online' ? 'cash' : 'online'
    payAhead.setMethod(next)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-method='${next}']`)?.focus()
  }

  return (
    <div className='flex flex-col gap-2'>
      <div role='radiogroup' aria-label={t('payAheadLabel')} onKeyDown={onKeyDown} className='bg-background/10 relative grid grid-cols-2 rounded-full p-1'>
        {methods.map((method) => {
          const on = method === current
          const Icon = method === 'online' ? CreditCard : Banknote
          return (
            <button
              key={method}
              type='button'
              role='radio'
              data-method={method}
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => payAhead.setMethod(method)}
              className='relative flex h-10 items-center justify-center gap-2 rounded-full text-note font-semibold'
            >
              {on && <motion.span layoutId='pay-method' transition={SPRING} aria-hidden className='bg-background text-foreground absolute inset-0 rounded-full' />}
              <span className={cn('relative flex min-w-0 items-center gap-2', on && 'text-foreground')}>
                <Icon className='size-4 shrink-0' />
                <span className='truncate'>{t(method === 'online' ? 'payAheadOnline' : delivering ? 'payAheadCashDelivery' : 'payAheadCashPickup')}</span>
              </span>
            </button>
          )
        })}
      </div>
      {payAhead.online && (fee > 0 || payAhead.holdsCards) && (
        <div className='flex flex-col gap-1 px-1 text-caption'>
          {fee > 0 && (
            <span className='flex items-center justify-between opacity-80'>
              <span>{t('payAheadFee')}</span>
              <span className='font-semibold tabular-nums'>{price(fee)}</span>
            </span>
          )}
          {payAhead.holdsCards && <span className='opacity-70'>{t('payAheadHeld', { name: business })}</span>}
        </div>
      )}
    </div>
  )
}
