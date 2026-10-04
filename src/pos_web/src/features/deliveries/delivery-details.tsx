import { MapPin, Navigation, Phone } from 'lucide-react'
import type { DeliveryView } from '@/api/ordering/types.gen'
import { useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * Google Maps' way to the door, from wherever the rider is: to the pin, or,
 * for an address the till took over the phone without one, to its words
 */
export function directionsUrl(delivery: Pick<DeliveryView, 'latitude' | 'longitude' | 'address'>): string {
  const destination =
    delivery.latitude != null && delivery.longitude != null
      ? `${toNumber(delivery.latitude)},${toNumber(delivery.longitude)}`
      : encodeURIComponent(delivery.address ?? '')
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/** The address on one line, the street first */
export function useAddressLine() {
  const t = useT()
  return (d: DeliveryView) => {
    const parts = [
      d.building ? `${t('deliveryBuilding')} ${d.building}` : null,
      d.floor ? `${t('deliveryFloor')} ${d.floor}` : null,
      d.apartment ? `${t('deliveryApartment')} ${d.apartment}` : null,
    ].filter(Boolean)
    return parts.length > 0 ? `${d.address} · ${parts.join('، ')}` : (d.address ?? '')
  }
}

/** How far, said briefly: 800 m, 2.4 km */
export function distanceText(meters: number, t: ReturnType<typeof useT>): string {
  return meters < 950 ? t('distanceM', { value: Math.max(10, Math.round(meters / 10) * 10) }) : t('distanceKm', { value: Math.round(meters / 100) / 10 })
}

/**
 * Where an order is going, for the till: the address and the rider's note,
 * the phone to call, how far, the fee, and the map a tap away.
 */
export function DeliveryDetails({ delivery, className }: { delivery: DeliveryView; className?: string }) {
  const t = useT()
  const money = useMoney()
  const line = useAddressLine()
  const fee = toNumber(delivery.fee)

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
          className='text-foreground flex shrink-0 items-center gap-1.5 font-medium'
        >
          <Navigation className='size-3.5' />
          {t('deliveryMap')}
        </a>
      </div>
      <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1'>
        {delivery.phone && (
          <a href={`tel:${delivery.phone}`} className='text-foreground flex items-center gap-1.5 font-medium'>
            <Phone className='size-3.5 shrink-0' />
            {/* Only the digits run left to right; the icon stays at the line's start */}
            <span dir='ltr'>{delivery.phone}</span>
          </a>
        )}
        {delivery.distanceMeters != null && <span>{distanceText(toNumber(delivery.distanceMeters), t)}</span>}
        <span>
          {t('deliveryFee')}: {fee > 0 ? money(fee) : t('deliveryFree')}
        </span>
      </div>
    </div>
  )
}
