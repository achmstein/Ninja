import { useState, type KeyboardEvent } from 'react'
import { motion } from 'motion/react'
import { Bike, ChevronRight, Loader2, LogIn, MapPin, ShoppingBag, Store } from 'lucide-react'
import { GuestSignInChoices } from '@/components/auth/sign-in-options'
import { shownLabel } from '@/lib/address-line'
import { useAtBranch } from '@/lib/at-branch'
import { useBranches, useSelectedBranch } from '@/lib/branch'
import { addressLine, type DeliveryState } from '@/lib/delivery'
import { useDistance } from '@/lib/geo'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { useBranchesByDistance, useBranchSwitch } from '@/lib/use-branch-switch'
import { cn } from '@/lib/utils'
import { BranchSheet } from '@/components/branch-switcher'
import { AddressSheet } from './address-sheet'

const SPRING = { type: 'spring', stiffness: 420, damping: 40 } as const

/**
 * Brings what stands in the way of the delivery into sight: the lines under
 * the address (short of the minimum, out of range, no address yet), scrolled
 * to the middle of the order and nudged once so the eye finds them. Called
 * when the order button is pressed while the order cannot be sent.
 */
export function showDeliveryNote() {
  const note = document.querySelector<HTMLElement>('[data-delivery-note]')
  if (!note) return
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  note.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
  if (!calm) note.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 450, delay: 250, easing: 'ease-out' })
}

/**
 * In the open order, where the branch delivers and the customer is not at a
 * table: collect it or have it brought. Brought, the address is a tap away,
 * and under it what the branch says about it — the fee (with the named
 * area the address is in and about how long it takes there, when the branch
 * says), how much more the items must come to, that it does not go that far
 * (with the nearest branch that does, a tap away too), or that it is not
 * delivering to that area right now.
 */
export function DeliveryChoice({ delivery, cloudKitchen }: { delivery: DeliveryState; cloudKitchen: boolean }) {
  const t = useT()
  const price = usePrice()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { address } = delivery
  const modes = ['pickup', 'delivery'] as const
  const words = { building: t('deliveryBuilding'), floor: t('deliveryFloor'), apartment: t('deliveryApartment') }
  const area = localized(delivery.zoneName)
  const off = delivery.problem === 'areaOff'
  // The area and about how long it takes, whichever the branch said: "Maadi Degla · about 45 min"
  const areaLine = [area, delivery.etaMinutes != null ? t('deliveryAboutMinutes', { minutes: delivery.etaMinutes }) : null].filter(Boolean).join(' · ')

  // A radio group: one stop for Tab, the arrows move between the two (and choose), as a native one does
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next = !delivery.active
    delivery.setWanted(next)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode='${next ? 'delivery' : 'pickup'}']`)?.focus()
  }

  return (
    <div className='flex flex-col gap-2'>
      <div
        role='radiogroup'
        aria-label={t('deliveryModeLabel')}
        onKeyDown={onKeyDown}
        className='bg-background/10 relative grid grid-cols-2 rounded-full p-1'
      >
        {modes.map((mode) => {
          const on = (mode === 'delivery') === delivery.active
          const Icon = mode === 'delivery' ? Bike : cloudKitchen ? ShoppingBag : Store
          return (
            <button
              key={mode}
              type='button'
              role='radio'
              data-mode={mode}
              aria-checked={on}
              tabIndex={on ? 0 : -1}
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

      {/* The branch brings orders to signed-in customers only: no address
          for a guest to fill in, but the way to sign in, right here */}
      {delivery.problem === 'signIn' && (
        <div className='bg-background/10 flex flex-col gap-3 rounded-2xl p-3' role='status'>
          <span className='flex items-center gap-2 text-note font-semibold'>
            <LogIn className='size-4 shrink-0' />
            {t('deliveryNeedsAccount')}
          </span>
          <div className='text-foreground bg-background rounded-xl p-3'>
            <GuestSignInChoices />
          </div>
        </div>
      )}

      {!delivery.active && <PickupFrom />}

      {delivery.active && delivery.problem !== 'signIn' && (
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
                  <span className='block truncate text-note font-semibold'>
                    {shownLabel(address.label, { home: t('deliveryLabelHome'), work: t('deliveryLabelWork') }) || address.address}
                  </span>
                  <span className='block truncate text-caption opacity-70'>{addressLine(address, words, language)}</span>
                </>
              ) : (
                <span className='block text-note font-semibold'>{t('deliveryAddAddress')}</span>
              )}
            </span>
            <ChevronRight className='size-4 shrink-0 opacity-60 rtl:rotate-180' />
          </button>

          {/* What stands in the way of the delivery is said here, as text. The order button, pressed while it
              cannot send, brings these lines into sight (showDeliveryNote), however long the order is */}
          <div data-delivery-note className='flex flex-col gap-1 px-1 text-caption'>
            {delivery.problem === 'checking' && (
              <span className='flex items-center gap-2 opacity-70'>
                <Loader2 className='size-3.5 animate-spin' />
                {t('deliveryChecking')}
              </span>
            )}
            {delivery.problem === 'quoteFailed' && (
              <span className='flex items-center gap-3 font-semibold text-amber-300' role='status'>
                {t('deliveryQuoteFailed')}
                <button type='button' onClick={delivery.retryQuote} className='min-h-11 underline underline-offset-4'>
                  {t('deliveryRetry')}
                </button>
              </span>
            )}
            {delivery.problem === 'range' && <OutOfRange delivery={delivery} />}
            {off && (
              <span className='font-semibold text-amber-300' role='status'>
                {area ? t('deliveryAreaOff', { area }) : t('problemAreaOff')}
              </span>
            )}
            {delivery.quoted && delivery.inRange && !off && (
              <>
                <span className='flex items-center justify-between opacity-80'>
                  <span>{t('deliveryFee')}</span>
                  <span className='font-semibold tabular-nums'>{delivery.fee > 0 ? price(delivery.fee) : t('deliveryFree')}</span>
                </span>
                {areaLine && <span className='opacity-70'>{areaLine}</span>}
              </>
            )}
            {delivery.problem === 'minimum' && (
              <span className='font-semibold text-amber-300'>{t('deliveryAddMore', { amount: price(delivery.short) })}</span>
            )}
          </div>
        </>
      )}

      <AddressSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}

/**
 * The address is not this branch's. No branch goes that far: said so.
 * Another does, but the customer is at this one (a bill, a hold, a clock),
 * so the order did not move by itself: that branch, a tap away.
 */
function OutOfRange({ delivery }: { delivery: DeliveryState }) {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const branch = useSelectedBranch()
  const { data: branches = [] } = useBranches()
  const { request } = useBranchSwitch()
  const other = delivery.servedBy
  const otherBranch = other ? branches.find((b) => Number(b.id) === other.branchId) : undefined

  if (!delivery.reached) return <span className='font-semibold text-amber-300'>{t('deliveryNoBranchReaches')}</span>
  return (
    <>
      <span className='font-semibold text-amber-300'>{t('deliveryOutOfRange', { name: localized(branch?.name) })}</span>
      {other && otherBranch && (
        <button type='button' onClick={() => request(other.branchId)} className='self-start font-semibold underline underline-offset-4'>
          {t('deliveryTryBranch', { name: localized(otherBranch.name), distance: distance(other.meters) })}
        </button>
      )}
    </>
  )
}

/**
 * Collected: from which branch, said before the order goes, with how far it
 * is when the customer's position is known (never asked for here) and the
 * branch a tap away to change, unless the customer is at this one. In the
 * delivery choice, and on its own in the order of a business that does not
 * deliver ([onlyWithChoice]: there only when there is more than one branch).
 */
export function PickupFrom({ onlyWithChoice = false }: { onlyWithChoice?: boolean } = {}) {
  const t = useT()
  const localized = useLocalized()
  const distance = useDistance()
  const branch = useSelectedBranch()
  const { data: branches = [] } = useBranches()
  const atBranch = useAtBranch()
  const { sorted } = useBranchesByDistance(false)
  const [open, setOpen] = useState(false)
  if (!branch || (onlyWithChoice && branches.length < 2)) return null
  const meters = sorted.find((s) => s.item.id === branch.id)?.meters ?? null
  const canChange = branches.length > 1 && !atBranch
  const body = (
    <>
      <Store className='size-5 shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-note font-semibold'>{t('pickupFrom', { name: localized(branch.name) })}</span>
        {(meters != null || localized(branch.address)) && (
          <span className='block truncate text-caption opacity-70'>
            {[meters != null ? distance(meters) : null, localized(branch.address)].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      {canChange && <ChevronRight className='size-4 shrink-0 opacity-60 rtl:rotate-180' />}
    </>
  )
  const box = 'bg-background/10 flex min-h-14 items-center gap-3 rounded-2xl px-3 py-2.5 text-start'
  if (!canChange) return <div className={box}>{body}</div>
  return (
    <>
      <button type='button' onClick={() => setOpen(true)} className={box}>
        {body}
      </button>
      <BranchSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
