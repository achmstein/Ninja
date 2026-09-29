import { Bike, Store, TriangleAlert } from 'lucide-react'
import type { PlatformOrderView } from '@/api/ordering/types.gen'
import { useLocale, useT, type TranslationKey } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/** The delivery platforms whose own mark we show; anything else falls back to its name. */
const platformLogos: Record<string, string> = {
  Talabat: `${import.meta.env.BASE_URL}platforms/talabat.svg`,
}

/**
 * Why staff turn a platform's order down, as the platform spells it; the
 * platform tells its customer. Too busy is the answer when nothing else fits.
 */
export const platformRejectReasons: { value: string; key: TranslationKey }[] = [
  { value: 'TOO_BUSY', key: 'rejectTooBusy' },
  { value: 'ITEM_UNAVAILABLE', key: 'rejectItemUnavailable' },
  { value: 'CLOSED', key: 'rejectClosed' },
  { value: 'NO_COURIER', key: 'rejectNoCourier' },
  { value: 'OUTSIDE_DELIVERY_AREA', key: 'rejectOutsideArea' },
  { value: 'FRAUD_PRANK', key: 'rejectPrank' },
]

/**
 * A delivery platform's order, as the counter needs it: the platform's own
 * logo (so it is never mistaken for one of ours) and the code its rider asks
 * for.
 */
export function PlatformBadge({
  platform,
  className,
}: {
  platform: PlatformOrderView
  className?: string
}) {
  const t = useT()
  const logo = platformLogos[platform.name ?? '']
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {logo ? (
        <img src={logo} alt={platform.name} className='h-4 w-auto' />
      ) : (
        <span className='text-sm font-semibold'>{platform.name}</span>
      )}
      <span className='font-mono text-sm font-semibold tabular-nums' dir='ltr'>
        {platform.shortCode ?? platform.code}
      </span>
      {platform.cancelledAt && (
        <span className='text-destructive flex items-center gap-1 text-sm'>
          <TriangleAlert className='size-3.5' />
          {t('platformCancelled')}
        </span>
      )}
    </span>
  )
}

/** How a platform's order leaves: the platform's rider (and when), the customer, or ours to an address. */
export function PlatformHandover({
  platform,
  className,
}: {
  platform: PlatformOrderView
  className?: string
}) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const time = (value?: string | null) =>
    value
      ? new Date(value).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
      : null
  const collect = toNumber(platform.collectFromCustomer)

  if (platform.expedition === 'Pickup') {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <Store className='size-3.5 shrink-0' />
        {t('platformCollect')}
        {time(platform.dueAt) && ` · ${time(platform.dueAt)}`}
      </span>
    )
  }

  if (platform.expedition === 'VendorDelivery') {
    return (
      <span className={cn('flex items-center gap-1', className)}>
        <Bike className='size-3.5 shrink-0' />
        <span className='truncate'>
          {t('platformOwnRider')}
          {platform.deliveryAddress && ` · ${platform.deliveryAddress}`}
          {!platform.paidOnline && collect > 0 && ` · ${t('platformCollectCash', { amount: money(collect) })}`}
        </span>
      </span>
    )
  }

  const riderAt = time(platform.riderPickupAt)
  return (
    <span className={cn('flex items-center gap-1', className)}>
      <Bike className='size-3.5 shrink-0' />
      {riderAt ? t('platformRiderAt', { time: riderAt }) : t('sourceTalabat')}
    </span>
  )
}
