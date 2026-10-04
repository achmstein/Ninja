import { useState } from 'react'
import { motion } from 'motion/react'
import { Bike, ChevronRight, Loader2, MapPin, ShoppingBag, Store } from 'lucide-react'
import { useBranches, useSelectedBranch } from '@/lib/branch'
import { addressLine, type DeliveryState } from '@/lib/delivery'
import { distanceMeters, pointOf, useDistance } from '@/lib/geo'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { useBranchSwitch } from '@/lib/use-branch-switch'
import { cn } from '@/lib/utils'
import { AddressSheet } from './address-sheet'

const SPRING = { type: 'spring', stiffness: 420, damping: 40 } as const

/**
 * In the open order, where the branch delivers and the customer is not at a
 * table: collect it or have it brought. Brought, the address is a tap away,
 * and under it what the branch says about it — the fee, how much more the
 * dishes must come to, or that it does not go that far (with the nearest
 * branch that does, a tap away too).
 */
export function DeliveryChoice({ delivery, cloudKitchen }: { delivery: DeliveryState; cloudKitchen: boolean }) {
  const t = useT()
  const price = usePrice()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { address } = delivery

  return (
    <div className='flex flex-col gap-2'>
      <div role='radiogroup' className='bg-background/10 relative grid grid-cols-2 rounded-full p-1'>
        {(['pickup', 'delivery'] as const).map((mode) => {
          const on = (mode === 'delivery') === delivery.active
          const Icon = mode === 'delivery' ? Bike : cloudKitchen ? ShoppingBag : Store
          return (
            <button
              key={mode}
              type='button'
              role='radio'
              aria-checked={on}
              onClick={() => delivery.setWanted(mode === 'delivery')}
              className='relative flex h-10 items-center justify-center gap-2 rounded-full text-note font-semibold'
            >
              {on && (
                <motion.span
                  layoutId='delivery-mode'
                  transition={SPRING}
                  aria-hidden
                  className='bg-background text-foreground absolute inset-0 rounded-full'
                />
              )}
              <span className={cn('relative flex items-center gap-2', on && 'text-foreground')}>
                <Icon className='size-4' />
                {t(mode === 'delivery' ? 'deliveryDeliver' : 'deliveryPickup')}
              </span>
            </button>
          )
        })}
      </div>

      {delivery.active && (
        <>
          <button
            type='button'
            onClick={() => setSheetOpen(true)}
            className='bg-background/10 flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-start'
          >
            <MapPin className='size-5 shrink-0' />
            <span className='min-w-0 flex-1'>
              {address ? (
                <>
                  <span className='block truncate text-note font-semibold'>{address.label || address.address}</span>
                  <span className='block truncate text-caption opacity-70'>
                    {addressLine(address, { building: t('deliveryBuilding'), floor: t('deliveryFloor'), apartment: t('deliveryApartment') })}
                  </span>
                </>
              ) : (
                <span className='block text-note font-semibold'>{t('deliveryAddAddress')}</span>
              )}
            </span>
            <ChevronRight className='size-4 shrink-0 opacity-60 rtl:rotate-180' />
          </button>

          <div className='flex flex-col gap-1 px-1 text-caption'>
            {delivery.problem === 'checking' && (
              <span className='flex items-center gap-2 opacity-70'>
                <Loader2 className='size-3.5 animate-spin' />
                {t('deliveryChecking')}
              </span>
            )}
            {delivery.problem === 'range' && <OutOfRange delivery={delivery} />}
            {delivery.quoted && delivery.inRange && (
              <span className='flex items-center justify-between opacity-80'>
                <span>{t('deliveryFee')}</span>
                <span className='font-semibold tabular-nums'>{delivery.fee > 0 ? price(delivery.fee) : t('deliveryFree')}</span>
              </span>
            )}
            {delivery.problem === 'minimum' && (
              <span className='font-semibold text-amber-300'>{t('deliveryAddMore', { amount: price(delivery.short) })}</span>
            )}
            {delivery.ready && <span className='opacity-70'>{t('deliveryCashAtDoor')}</span>}
          </div>
        </>
      )}

      <AddressSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}

/** This branch does not go that far: the nearest branch that does, if any, a tap away */
function OutOfRange({ delivery }: { delivery: DeliveryState }) {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const branch = useSelectedBranch()
  const { data: branches = [] } = useBranches()
  const { request, dialog } = useBranchSwitch()
  const address = delivery.address

  const here = address ? { lat: address.latitude, lng: address.longitude } : null
  const nearest = here
    ? branches
        .filter((b) => b.isDeliveryEnabled && b.id !== branch?.id)
        .map((b) => {
          const point = pointOf(b)
          return { branch: b, meters: point ? distanceMeters(here, point) : null }
        })
        .filter((c): c is { branch: (typeof branches)[number]; meters: number } => c.meters != null && c.meters <= Number(c.branch.deliveryRadiusKm ?? 0) * 1000)
        .sort((a, b) => a.meters - b.meters)[0]
    : undefined

  return (
    <>
      <span className='font-semibold text-amber-300'>{t('deliveryOutOfRange', { name: localized(branch?.name) })}</span>
      {nearest && (
        <button type='button' onClick={() => request(Number(nearest.branch.id))} className='self-start font-semibold underline underline-offset-4'>
          {t('deliveryTryBranch', { name: localized(nearest.branch.name), distance: distance(nearest.meters) })}
        </button>
      )}
      {dialog}
    </>
  )
}
