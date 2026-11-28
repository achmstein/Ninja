import { AlertTriangle, Bike, Loader2, Store, UserRound, X } from 'lucide-react'
import { useLocalized, useT } from '@/lib/i18n'
import { showPhone } from '@/lib/phone'
import { Button } from '@/components/ui/button'
import { useBranchName } from '@/features/branch/use-branch-name'
import { PinQualityLabel } from '@/features/deliveries/pin-quality'
import type { SaleDelivery } from './cart'
import type { DeliveryReadiness } from './sale-delivery'

/**
 * The delivery on the sale, under the customer: where it goes and the number
 * the rider calls, a tap to change it, a cross to make it a counter sale
 * again. When it can't go yet (terms being read, unreadable, delivery off) it
 * says so with the way out, and the sale waits. One sent to the branch
 * nearer the caller says which. The branch's named area it goes to comes
 * before the street.
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
  const branchName = useBranchName()
  const localized = useLocalized()
  // An area is its branch's own: none on a delivery another branch makes
  const area = delivery.sendTo ? '' : localized(delivery.zone?.name)
  return (
    <div className='bg-muted type-detail mt-2 flex flex-col gap-2 rounded-lg p-2.5'>
      <div className='flex items-start gap-2'>
        <Bike className='text-muted-foreground mt-0.5 size-4 shrink-0' aria-hidden />
        <button type='button' onClick={onEdit} className='min-w-0 flex-1 text-start' aria-label={t('deliveryChange')}>
          <span className='block truncate font-medium'>
            {[area, delivery.address, delivery.building].filter(Boolean).join(' · ')}
          </span>
          <span className='text-muted-foreground type-caption flex items-center gap-1'>
            <span dir='ltr'>{showPhone(delivery.phone)}</span>
          </span>
          <PinQualityLabel source={delivery.pinSource} pinned={delivery.latitude != null} className='mt-1' />
          {!delivery.sendTo && delivery.rider && (
            <span className='type-caption mt-0.5 flex items-center gap-1 font-medium'>
              <UserRound className='size-3' aria-hidden />
              {t('deliveryForRiderName', { name: delivery.rider.name })}
            </span>
          )}
          {delivery.sendTo && (
            <span className='text-primary type-caption mt-0.5 flex items-center gap-1 font-medium'>
              <Store className='size-3' aria-hidden />
              {t('deliveryWillSend', { branch: branchName(delivery.sendTo.branchId) })}
            </span>
          )}
        </button>
        <Button
          variant='ghost'
          size='icon'
          className='size-11 shrink-0'
          aria-label={t('deliveryNotADelivery')}
          onClick={onRemove}
        >
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
            {readiness === 'loading'
              ? t('deliveryTermsLoading')
              : readiness === 'failed'
                ? t('deliveryTermsFailed')
                : t('deliveryTermsOff')}
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
