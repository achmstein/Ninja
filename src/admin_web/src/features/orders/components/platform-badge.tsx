import { Bike, Store, TriangleAlert } from 'lucide-react'
import { type PlatformOrderView } from '@/api/ordering'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatEgp } from '../status'

/** The delivery platforms whose own mark we show; anything else falls back to its name. */
const platformLogos: Record<string, string> = {
  Talabat: `${import.meta.env.BASE_URL}platforms/talabat.svg`,
}

/**
 * A delivery platform's order, as the counter needs it: the platform's own
 * logo (so it is never mistaken for one of ours), the code its rider asks
 * for, and how the order leaves.
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
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {logo ? (
        <img src={logo} alt={platform.name} className='h-3.5 w-auto' />
      ) : (
        <span className='text-xs font-semibold'>{platform.name}</span>
      )}
      <span className='font-mono text-xs font-semibold tabular-nums' dir='ltr'>
        {platform.shortCode ?? platform.code}
      </span>
      {platform.cancelledAt && (
        <span className='text-destructive flex items-center gap-1 text-xs'>
          <TriangleAlert className='h-3 w-3' />
          {t('platformCancelled')}
        </span>
      )}
    </span>
  )
}

/** How a platform's order leaves: the platform's rider (and when), the customer, or ours to an address. */
export function PlatformHandover({ platform }: { platform: PlatformOrderView }) {
  const t = useT()
  const locale = useLocale()
  const time = (value?: string | null) =>
    value ? new Date(value).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }) : null
  const collect = Number(platform.collectFromCustomer ?? 0)

  if (platform.expedition === 'Pickup') {
    return (
      <span className='flex items-center gap-1'>
        <Store className='h-3 w-3' />
        {t('platformCollect')}
        {time(platform.dueAt) && ` · ${time(platform.dueAt)}`}
      </span>
    )
  }

  if (platform.expedition === 'VendorDelivery') {
    return (
      <span className='flex items-center gap-1'>
        <Bike className='h-3 w-3' />
        {t('platformOwnRider')}
        {platform.deliveryAddress && ` · ${platform.deliveryAddress}`}
        {!platform.paidOnline && collect > 0 && ` · ${t('platformCollectCash', { amount: formatEgp(collect) })}`}
      </span>
    )
  }

  return (
    <span className='flex items-center gap-1'>
      <Bike className='h-3 w-3' />
      {time(platform.riderPickupAt)
        ? t('platformRiderAt', { time: time(platform.riderPickupAt)! })
        : t('sourceTalabat')}
    </span>
  )
}
