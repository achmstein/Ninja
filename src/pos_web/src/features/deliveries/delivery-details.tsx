import { MapPin, Navigation, Phone } from 'lucide-react'
import type { DeliveryView } from '@/api/ordering/types.gen'
import { useLanguage, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { directionsUrl, distanceParts, formatAddressLine, telHref, type AddressParts } from './delivery-format'

/** The address on one line in the till's language, the street first */
export function useAddressLine() {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const words = { building: t('deliveryBuilding'), floor: t('deliveryFloor'), apartment: t('deliveryApartment') }
  return (parts: AddressParts) => formatAddressLine(parts, words, language)
}

/** How far, said briefly: 800 m, 2.4 km */
export function useDistanceText() {
  const t = useT()
  return (meters: number) => {
    const d = distanceParts(meters)
    return d.unit === 'm' ? t('distanceM', { value: d.value }) : t('distanceKm', { value: d.value })
  }
}

/**
 * Where an order is going, for the till: the address and the rider's note,
 * the phone to call, how far, the fee, and the map a tap away.
 */
export function DeliveryDetails({ delivery, className }: { delivery: DeliveryView; className?: string }) {
  const t = useT()
  const money = useMoney()
  const line = useAddressLine()
  const distance = useDistanceText()
  const fee = toNumber(delivery.fee)
  const tel = telHref(delivery.phone)

  return (
    <div className={cn('bg-muted flex flex-col gap-2 rounded-lg p-3 text-sm', className)}>
      {/* The address, with the map at the end of its line so it never drops
          onto a line of its own */}
      <div className='flex items-start gap-2'>
        <MapPin className='text-muted-foreground mt-0.5 size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='font-medium'>{line(delivery)}</div>
          {delivery.directions && <div className='text-muted-foreground italic'>"{delivery.directions}"</div>}
        </div>
        <a
          href={directionsUrl(delivery)}
          target='_blank'
          rel='noreferrer'
          className='text-foreground flex min-h-11 shrink-0 items-center gap-1.5 px-1 font-medium'
        >
          <Navigation className='size-3.5' />
          {t('deliveryMap')}
        </a>
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1'>
        {tel && (
          <a href={tel} className='text-foreground flex min-h-11 items-center gap-1.5 font-medium'>
            <Phone className='size-3.5 shrink-0' />
            {/* Only the digits run left to right; the icon stays at the line's start */}
            <span dir='ltr'>{delivery.phone}</span>
          </a>
        )}
        {delivery.distanceMeters != null && <span>{distance(toNumber(delivery.distanceMeters))}</span>}
        <span>
          {t('deliveryFee')}: {fee > 0 ? money(fee) : t('deliveryFree')}
        </span>
      </div>
    </div>
  )
}
