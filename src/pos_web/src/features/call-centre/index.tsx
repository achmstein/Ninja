import { useId, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Bike, Headset, History, Loader2, MapPin, ShoppingBag, Store } from 'lucide-react'
import { getKnownDeliveryAddressesOptions, resolveDeliveryBranchForStaffOptions } from '@/api/ordering/@tanstack/react-query.gen'
import type { KnownAddressView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBranchName } from '@/features/branch/use-branch-name'
import { useAddressLine, useDistanceText } from '@/features/deliveries/delivery-details'
import { emptyDelivery, useSale, type SaleDelivery } from '@/features/sale/cart'
import { DELIVERY_LIMITS, MIN_PHONE_DIGITS, validatePhoneDelivery } from '@/features/sale/sale-delivery'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { digitCount, normalizePhone } from '@/lib/phone'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { useBranchStore } from '@/stores/branch-store'
import { callerDelivery, chosenBranch } from './call-centre'

/**
 * The call centre's "next caller": every sale starts from who is calling and
 * where they are, not from a branch. Their number brings up the addresses any
 * branch delivered them to; the address (a pasted Maps link, or coordinates)
 * picks the nearest branch that delivers there, which the agent may change —
 * or the caller collects, at a branch they name. The till then switches to
 * that branch and the order is rung up there as any other: its menu, its
 * prices, its kitchen, its riders. No drawer, no shift, no tables.
 */
export function CallCentre() {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const line = useAddressLine()
  const distance = useDistanceText()
  const branchName = useBranchName()
  const ids = useId()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const country = useBrand()?.locale.country ?? 'EG'
  const { branches: allBranches } = useAllowedBranches()
  const setBranchId = useBranchStore((s) => s.setBranchId)
  const sale = useSale()

  const [name, setName] = useState('')
  const [form, setForm] = useState<SaleDelivery>(emptyDelivery)
  const [picked, setPicked] = useState<number | null>(null)
  const [confirmingPaused, setConfirmingPaused] = useState<number | null>(null)
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<SaleDelivery>) => setForm((f) => ({ ...f, ...patch }))

  const lookupPhone = useDebounced(digitCount(form.phone) >= MIN_PHONE_DIGITS ? normalizePhone(form.phone, country) : '', 400)
  const known = useQuery({
    ...getKnownDeliveryAddressesOptions({
      // Any branch's deliveries: the call centre answers for all of them
      query: {
        'api-version': API_VERSION,
        phone: lookupPhone || undefined,
        everyBranch: true,
      },
    }),
    enabled: lookupPhone !== '',
  })

  const location = useDebounced(form.location.trim(), 400)
  const resolution = useQuery({
    ...resolveDeliveryBranchForStaffOptions({
      query: { 'api-version': API_VERSION, location: location || undefined },
    }),
    enabled: location !== '',
    staleTime: 60_000,
  })
  const settled = location === form.location.trim() && !resolution.isFetching
  const answer = settled && location !== '' ? resolution.data : undefined
  const reaching = answer?.branches ?? []
  const branchId = chosenBranch(reaching, picked)
  const chosen = reaching.find((b) => toNumber(b.branchId) === branchId) ?? null
  const pin =
    answer?.latitude != null && answer.longitude != null
      ? {
          latitude: toNumber(answer.latitude),
          longitude: toNumber(answer.longitude),
        }
      : null

  const pickKnown = (a: KnownAddressView) => {
    setPicked(null)
    setForm({
      address: a.address,
      building: a.building ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      directions: a.directions ?? '',
      phone: form.phone || a.phone || '',
      location: a.latitude != null && a.longitude != null ? `${toNumber(a.latitude)}, ${toNumber(a.longitude)}` : '',
      latitude: null,
      longitude: null,
    })
  }

  /** The till moves to the branch that makes the order, and the sale pad opens there with the caller on it */
  const startAt = (target: number, delivery: SaleDelivery | null) => {
    sale.setTarget(null)
    sale.clear()
    sale.setCustomer({
      id: null,
      name: name.trim(),
      phone: normalizePhone(form.phone, country),
    })
    sale.setDelivery(delivery)
    if (target !== useBranchStore.getState().branchId) {
      setBranchId(target)
      // Everything on screen is the branch's: its menu, its prices, its stock
      queryClient.resetQueries()
    }
    navigate({ to: '/sale' })
  }

  const errors = validatePhoneDelivery(form, name, true)
  const deliver = () => {
    setTried(true)
    if (Object.keys(errors).length > 0 || branchId == null || !settled) return
    startAt(branchId, callerDelivery({ ...form, phone: normalizePhone(form.phone, country) }, pin))
  }

  const pickup = (target: number) => {
    setTried(true)
    if (!name.trim() || digitCount(form.phone) < MIN_PHONE_DIGITS) return
    startAt(target, null)
  }

  const reading = form.location.trim() !== '' && !settled

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5 p-4'>
      <h1 className='flex items-center gap-2 text-2xl font-bold'>
        <Headset className='size-6' aria-hidden />
        {t('callCentreNextCaller')}
      </h1>

      <div className='grid gap-3 sm:grid-cols-2'>
        <Labelled id={`${ids}-phone`} label={t('deliveryPhoneLabel')} error={tried && errors.phone ? t('deliveryPhoneInvalid') : null}>
          <Input
            id={`${ids}-phone`}
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className='h-12 text-base'
            inputMode='tel'
            dir='ltr'
            autoComplete='off'
            autoFocus
          />
        </Labelled>
        <Labelled id={`${ids}-name`} label={t('deliveryCustomerName')} error={tried && errors.name ? t('deliveryNeedsName') : null}>
          <Input id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)} className='h-12 text-base' autoComplete='off' />
        </Labelled>
      </div>

      {(known.data ?? []).length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <span className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
            <History className='size-3.5' aria-hidden />
            {t('deliveryKnownAddresses')}
          </span>
          {(known.data ?? []).map((a) => (
            <button
              key={[a.address, a.building, a.floor, a.apartment, a.latitude, a.longitude].join('|')}
              type='button'
              onClick={() => pickKnown(a)}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-2.5 text-start text-sm',
                a.address === form.address && (a.building ?? '') === form.building ? 'border-primary bg-primary/5' : 'bg-background',
              )}
            >
              <MapPin className='text-muted-foreground mt-0.5 size-4 shrink-0' aria-hidden />
              <span className='min-w-0 flex-1'>
                {a.label && <span className='font-semibold'>{a.label} · </span>}
                {line(a)}
              </span>
            </button>
          ))}
        </div>
      )}

      <section className='flex flex-col gap-3 rounded-xl border p-4'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <Bike className='size-5' aria-hidden />
          {t('callCentreDelivery')}
        </h2>
        <Labelled id={`${ids}-street`} label={t('deliveryStreetLabel')} error={tried && errors.address ? t('deliveryNeedsStreet') : null}>
          <Input
            id={`${ids}-street`}
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            maxLength={DELIVERY_LIMITS.address}
            className='h-12 text-base'
            autoComplete='off'
          />
        </Labelled>
        <div className='grid grid-cols-3 gap-2'>
          {(
            [
              ['building', 'deliveryBuildingLabel'],
              ['floor', 'deliveryFloorLabel'],
              ['apartment', 'deliveryApartmentLabel'],
            ] as const
          ).map(([field, label]) => (
            <Labelled key={field} id={`${ids}-${field}`} label={t(label)}>
              <Input
                id={`${ids}-${field}`}
                value={form[field]}
                onChange={(e) => set({ [field]: e.target.value })}
                maxLength={DELIVERY_LIMITS[field]}
                className='h-12 text-base'
                autoComplete='off'
              />
            </Labelled>
          ))}
        </div>
        <Labelled id={`${ids}-directions`} label={t('deliveryDirectionsLabel')}>
          <Input
            id={`${ids}-directions`}
            value={form.directions}
            onChange={(e) => set({ directions: e.target.value })}
            placeholder={t('deliveryDirectionsHint')}
            maxLength={DELIVERY_LIMITS.directions}
            className='h-12 text-base'
            autoComplete='off'
          />
        </Labelled>
        <Labelled id={`${ids}-location`} label={t('deliveryLocationLabel')}>
          <Input
            id={`${ids}-location`}
            value={form.location}
            onChange={(e) => {
              setPicked(null)
              set({ location: e.target.value })
            }}
            placeholder='https://maps.app.goo.gl/…'
            className='h-12 text-base'
            dir='ltr'
            autoComplete='off'
          />
        </Labelled>

        {/* Which branches deliver there, nearest first: the suggestion is chosen, the agent may pick another */}
        <div className='flex flex-col gap-2 text-sm' aria-live='polite'>
          {!form.location.trim() ? (
            <p className='text-muted-foreground'>{t('callCentreLocationHint')}</p>
          ) : reading ? (
            <p className='text-muted-foreground flex items-center gap-1.5'>
              <Loader2 className='size-3.5 animate-spin' aria-hidden />
              {t('deliveryLocationReading')}
            </p>
          ) : resolution.isError ? (
            <p className='flex items-center gap-2 text-amber-700 dark:text-amber-400'>
              {t('deliveryQuoteFailed')}
              <Button variant='outline' size='sm' className='h-8' onClick={() => resolution.refetch()}>
                {t('retry')}
              </Button>
            </p>
          ) : answer && !answer.locationRead ? (
            <p className='text-muted-foreground'>{t('deliveryLocationUnread')}</p>
          ) : answer && !answer.delivers ? (
            <p className='text-muted-foreground'>{t('deliveryNotHere')}</p>
          ) : reaching.length === 0 ? (
            <p className='text-amber-700 dark:text-amber-400'>{t('callCentreNoBranchDelivers')}</p>
          ) : (
            reaching.map((b) => {
              const id = toNumber(b.branchId)
              const fee = toNumber(b.fee)
              const isChosen = id === branchId
              return (
                <button
                  key={id}
                  type='button'
                  onClick={() => {
                    // A paused branch stopped its customers' orders: the agent is asked once more
                    if (b.paused && confirmingPaused !== id) {
                      setConfirmingPaused(id)
                      return
                    }
                    setConfirmingPaused(null)
                    setPicked(id)
                  }}
                  className={cn(
                    'flex min-h-12 items-center gap-2 rounded-lg border p-3 text-start',
                    isChosen ? 'border-primary bg-primary/5' : 'bg-background',
                  )}
                >
                  <Store className='text-muted-foreground size-4 shrink-0' aria-hidden />
                  <span className='min-w-0 flex-1'>
                    <span className='font-medium'>{branchName(id)}</span>
                    <span className='text-muted-foreground'>
                      {' · '}
                      {distance(toNumber(b.distanceMeters))} · {fee > 0 ? money(fee) : t('deliveryFree')}
                    </span>
                    {b.paused && (
                      <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>
                        · {confirmingPaused === id ? t('callCentreTapAgainPaused') : t('deliveryBranchPaused')}
                      </span>
                    )}
                  </span>
                </button>
              )
            })
          )}
        </div>

        <Button size='lg' className='h-14 text-lg' onClick={deliver} disabled={reading || chosen == null}>
          {chosen ? t('callCentreDeliverFrom', { branch: branchName(branchId) }) : t('callCentreDeliver')}
        </Button>
      </section>

      <section className='flex flex-col gap-3 rounded-xl border p-4'>
        <h2 className='flex items-center gap-2 font-semibold'>
          <ShoppingBag className='size-5' aria-hidden />
          {t('callCentrePickupAt')}
        </h2>
        <div className='grid gap-2 sm:grid-cols-2'>
          {allBranches.map((b) => (
            <Button key={String(b.id)} variant='outline' className='h-12 justify-start text-base' onClick={() => pickup(Number(b.id))}>
              <Store className='size-4' aria-hidden />
              {localized(b.name)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Labelled({ id, label, error, children }: { id: string; label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </div>
  )
}
