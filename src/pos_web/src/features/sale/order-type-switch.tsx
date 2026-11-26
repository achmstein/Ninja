import { useState } from 'react'
import { Bike, Store } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * What kind of order this is, chosen first and always in sight at the top of
 * the sale: at the counter, or delivered. Delivery opens the phone form (and,
 * once set, opens it again to change it); going back to the counter drops the
 * address, so it takes a second tap, as the till's other undoings do.
 */
export function OrderTypeSwitch({
  delivering,
  onDelivery,
  onCounter,
}: {
  delivering: boolean
  onDelivery: () => void
  onCounter: () => void
}) {
  const t = useT()
  const [armed, setArmed] = useState(false)

  const option = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button
      type='button'
      role='radio'
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-3 text-base font-medium transition-colors',
        active ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5 dark:ring-white/10' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      <span className='truncate'>{label}</span>
    </button>
  )

  return (
    <div className='flex flex-col gap-1'>
      <div role='radiogroup' aria-label={t('orderTypeLabel')} className='bg-muted flex gap-1 rounded-lg p-1'>
        {option(
          !delivering,
          () => {
            if (!delivering) return
            if (!armed) return setArmed(true)
            setArmed(false)
            onCounter()
          },
          <Store className='size-5 shrink-0' aria-hidden />,
          t('orderTypeCounter'),
        )}
        {option(
          delivering,
          () => {
            setArmed(false)
            onDelivery()
          },
          <Bike className='size-5 shrink-0' aria-hidden />,
          t('deliverIt'),
        )}
      </div>
      {armed && (
        <p className='text-center type-detail font-medium text-amber-700 dark:text-amber-400' role='status'>
          {t('orderTypeCounterConfirm')}
        </p>
      )}
    </div>
  )
}
