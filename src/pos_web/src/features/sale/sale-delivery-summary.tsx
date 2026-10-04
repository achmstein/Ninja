import { AlertTriangle, Bike, Loader2, MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import type { SaleDelivery } from './cart'
import type { DeliveryReadiness } from './sale-delivery'

/**
 * The delivery on the sale, under the customer: where it goes and the number
 * the rider calls, a tap to change it, a cross to make it a counter sale
 * again. When it can't go yet (terms being read, unreadable, delivery off) it
 * says so with the way out, and the sale waits.
 */
export function SaleDeliverySummary({
  delivery,
  readiness,
  onEdit,
  onRemove,
  onRetry,
}: {
  delivery: SaleDelivery
  readiness: DeliveryReadiness
  onEdit: () => void
  onRemove: () => void
  onRetry: () => void
}) {
  const t = useT()
  return (
    <div className='bg-muted mt-2 flex flex-col gap-2 rounded-lg p-2.5 text-sm'>
      <div className='flex items-start gap-2'>
        <Bike className='text-muted-foreground mt-0.5 size-4 shrink-0' aria-hidden />
        <button type='button' onClick={onEdit} className='min-w-0 flex-1 text-start' aria-label={t('deliveryChange')}>
          <span className='block truncate font-medium'>{[delivery.address, delivery.building].filter(Boolean).join(' · ')}</span>
          <span className='text-muted-foreground flex items-center gap-1 text-xs'>
            {delivery.latitude != null && <MapPin className='size-3' aria-hidden />}
            <span dir='ltr'>{delivery.phone}</span>
            {delivery.latitude == null && <span>· {t('deliveryNoPin')}</span>}
          </span>
        </button>
        <Button variant='ghost' size='icon' className='size-11 shrink-0' aria-label={t('deliveryNotADelivery')} onClick={onRemove}>
          <X className='size-4' />
        </Button>
      </div>
      {readiness !== 'ready' && readiness !== 'none' && (
        <div role='status' className='flex flex-wrap items-center gap-2 text-amber-700 dark:text-amber-400'>
          {readiness === 'loading' ? (
            <Loader2 className='size-4 animate-spin' aria-hidden />
          ) : (
            <AlertTriangle className='size-4 shrink-0' aria-hidden />
          )}
          <span className='flex-1'>
            {readiness === 'loading' ? t('deliveryTermsLoading') : readiness === 'failed' ? t('deliveryTermsFailed') : t('deliveryTermsOff')}
          </span>
          {readiness === 'failed' && (
            <Button variant='outline' size='sm' className='h-9' onClick={onRetry}>
              {t('retry')}
            </Button>
          )}
          {readiness === 'off' && (
            <Button variant='outline' size='sm' className='h-9' onClick={onRemove}>
              {t('deliveryRemove')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
