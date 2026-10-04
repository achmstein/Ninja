import { Bike, MapPin, Navigation, Phone } from 'lucide-react'
import type { DeliveryView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
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
 * Where an order is going, for the till, read top to bottom: where to (with
 * how far), the street, the building, floor and flat under it, the rider's
 * note, then the two things the cashier does with it: call, or open the map.
 * The fee is money, so it sits with the bill's total (`DeliveryFeeRow`), not here.
 */
export function DeliveryDetails({ delivery, className }: { delivery: DeliveryView; className?: string }) {
  const t = useT()
  const line = useAddressLine()
  const distance = useDistanceText()
  const tel = telHref(delivery.phone)
  const details = line({ building: delivery.building, floor: delivery.floor, apartment: delivery.apartment })
  const pinned = delivery.latitude != null && delivery.longitude != null

  return (
    <section className={cn('flex flex-col gap-3 rounded-lg border p-3', className)} aria-label={t('deliverTo')}>
      <div className='text-muted-foreground flex items-center gap-2 text-sm'>
        <Bike className='size-4 shrink-0' />
        <span className='font-medium'>{t('deliverTo')}</span>
        {delivery.distanceMeters != null && (
          <span className='bg-muted ms-auto rounded-full px-2 py-0.5 text-xs tabular-nums'>
            {distance(toNumber(delivery.distanceMeters))}
          </span>
        )}
      </div>

      <div className='flex items-start gap-2'>
        <MapPin className='text-muted-foreground mt-1 size-4 shrink-0' />
        <div className='min-w-0 flex-1'>
          <div className='text-base font-semibold'>{delivery.address}</div>
          {details && <div className='text-muted-foreground text-sm'>{details}</div>}
          {delivery.directions && (
            <div className='text-muted-foreground mt-1 text-sm italic'>"{delivery.directions}"</div>
          )}
          {!pinned && <div className='text-muted-foreground mt-1 text-xs'>{t('deliveryNoPin')}</div>}
        </div>
      </div>

      <div className='grid grid-cols-2 gap-2'>
        {tel ? (
          <Button asChild variant='outline' className='h-11 justify-center gap-2'>
            <a href={tel}>
              <Phone className='size-4 shrink-0' />
              {/* Only the digits run left to right; the icon stays at the start */}
              <span dir='ltr' className='tabular-nums'>{delivery.phone}</span>
            </a>
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant='outline' className='h-11 justify-center gap-2'>
          <a href={directionsUrl(delivery)} target='_blank' rel='noreferrer'>
            <Navigation className='size-4 shrink-0' />
            {t('deliveryMap')}
          </a>
        </Button>
      </div>
    </section>
  )
}

/** The delivery fee as a line of the bill, just above its total */
export function DeliveryFeeRow({ delivery, className }: { delivery: DeliveryView; className?: string }) {
  const t = useT()
  const money = useMoney()
  const fee = toNumber(delivery.fee)
  return (
    <div className={cn('text-muted-foreground flex justify-between text-sm', className)}>
      <span>{t('deliveryFee')}</span>
      <span className='tabular-nums'>{fee > 0 ? money(fee) : t('deliveryFree')}</span>
    </div>
  )
}
