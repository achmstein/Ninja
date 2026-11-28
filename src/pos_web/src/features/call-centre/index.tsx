import { useId, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Bike, Headset, History, Loader2, MapPin, ShoppingBag, Store, X } from 'lucide-react'
import {
  getKnownDeliveryAddressesOptions,
  resolveDeliveryBranchForStaffOptions,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
import type { KnownAddressView } from '@ninja/api/ordering/types.gen'
import { useBranchStore } from '@/stores/branch-store'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { digitCount, normalizePhone } from '@/lib/phone'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBranchName } from '@/features/branch/use-branch-name'
import { AddressSearchField } from '@/features/deliveries/address-search-field'
import { AreaChoice } from '@/features/deliveries/area-picker'
import { useAddressLine, useDistanceText } from '@/features/deliveries/delivery-details'
import { PinQualityLabel } from '@/features/deliveries/pin-quality'
import { emptyDelivery, useSale, type PinSource, type SaleDelivery } from '@/features/sale/cart'
import { DELIVERY_LIMITS, MIN_PHONE_DIGITS, toSaleZone, validatePhoneDelivery } from '@/features/sale/sale-delivery'
import { branchOffers, callerDelivery, chosenArea, offeredBranch, pinArea } from './call-centre'

/**
 * The call centre's "next caller": every sale starts from who is calling and
 * where they are, not from a branch. Their number brings up the addresses any
 * branch delivered them to. A caller says where they live, they do not send a
 * link: where the business has Google's search, the street or landmark they
 * name is found on the map and the nearest branch whose area takes it in is
 * chosen, which the agent may change; with no point on the map the agent
 * picks the branch that delivers to that area. Or the caller collects, at a
 * branch they name. Where the branches keep named areas, the area the caller
 * says comes first: picked by name it settles the branch, the fee and the
 * minimum on its own. The till then switches to
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
  const brand = useBrand()
  const country = brand?.locale.country ?? 'EG'
  const searchOn = brand?.maps?.search === true
  const { branches: allBranches } = useAllowedBranches()
  const setBranchId = useBranchStore((s) => s.setBranchId)
  const sale = useSale()

  const [name, setName] = useState('')
  const [form, setForm] = useState<SaleDelivery>(emptyDelivery)
  const [picked, setPicked] = useState<number | null>(null)
  const [confirmingPaused, setConfirmingPaused] = useState<number | null>(null)
  // The named area the agent picked by name, and whether they took off the one the map point is in
  const [areaId, setAreaId] = useState<number | null>(null)
  const [areaOff, setAreaOff] = useState(false)
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<SaleDelivery>) => setForm((f) => ({ ...f, ...patch }))

  const lookupPhone = useDebounced(
    digitCount(form.phone) >= MIN_PHONE_DIGITS ? normalizePhone(form.phone, country) : '',
    400
  )
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

  // The point on the map, as coordinates: set by a search pick or an earlier address, never typed.
  // Asked with none too: the answer then lists every branch that delivers, for the agent to pick from
  const location = form.location.trim()
  const resolution = useQuery({
    ...resolveDeliveryBranchForStaffOptions({
      query: { 'api-version': API_VERSION, location: location || undefined },
    }),
    staleTime: 60_000,
    // The named areas are the same wherever the caller is: the picker keeps them while another point is asked
    placeholderData: keepPreviousData,
  })
  const settled = !resolution.isFetching && resolution.data !== undefined
  const answer = settled ? resolution.data : undefined
  const zones = resolution.data?.zones ?? []
  const reaching = answer?.branches ?? []
  const { offers, byHand } = branchOffers(reaching, answer?.delivering ?? [])
  const offered = offeredBranch(offers, byHand, picked)
  // The area picked by name goes first, with its branch; without one, the area the map point is in
  const area = chosenArea(zones, areaId, pinArea(reaching, zones, offered), areaOff)
  const branchId = area ? toNumber(area.branchId) : offered
  const pin =
    answer?.latitude != null && answer.longitude != null
      ? {
          latitude: toNumber(answer.latitude),
          longitude: toNumber(answer.longitude),
        }
      : null

  const pickKnown = (a: KnownAddressView) => {
    setPicked(null)
    // Another address altogether: its own point says the area again
    setAreaId(null)
    setAreaOff(false)
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
      // An earlier address keeps where its pin came from: the customer's own, a rider's, or a search
      pinSource: (a.pinSource as PinSource | undefined) ?? null,
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
    startAt(
      branchId,
      callerDelivery({ ...form, zone: area ? toSaleZone(area) : null, phone: normalizePhone(form.phone, country) }, pin)
    )
  }

  const pickup = (target: number) => {
    setTried(true)
    if (!name.trim() || digitCount(form.phone) < MIN_PHONE_DIGITS) return
    startAt(target, null)
  }

  const reading = !settled && !resolution.isError

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-5 p-4'>
      <h1 className='type-title flex items-center gap-2'>
        <Headset className='size-6' aria-hidden />
        {t('callCentreNextCaller')}
      </h1>

      <div className='grid gap-3 sm:grid-cols-2'>
        <Labelled
          id={`${ids}-phone`}
          label={t('deliveryPhoneLabel')}
          error={tried && errors.phone ? t('deliveryPhoneInvalid') : null}
        >
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
        <Labelled
          id={`${ids}-name`}
          label={t('deliveryCustomerName')}
          error={tried && errors.name ? t('deliveryNeedsName') : null}
        >
          <Input
            id={`${ids}-name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </Labelled>
      </div>

      {(known.data ?? []).length > 0 && (
        <div className='flex flex-col gap-1.5'>
          <span className='text-muted-foreground type-caption flex items-center gap-1.5 font-medium'>
            <History className='size-3.5' aria-hidden />
            {t('deliveryKnownAddresses')}
          </span>
          {(known.data ?? []).map((a) => (
            <button
              key={[a.address, a.building, a.floor, a.apartment, a.latitude, a.longitude].join('|')}
              type='button'
              onClick={() => pickKnown(a)}
              className={cn(
                'type-detail flex items-start gap-2 rounded-lg border p-2.5 text-start',
                a.address === form.address && (a.building ?? '') === form.building
                  ? 'border-primary bg-primary/5'
                  : 'bg-background'
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
        <h2 className='type-heading flex items-center gap-2'>
          <Bike className='size-5' aria-hidden />
          {t('callCentreDelivery')}
        </h2>
        {/* Where the branches keep named areas, what a caller says first is theirs: picked by name it
            settles the branch and what delivering there costs, whatever the map says */}
        {zones.length > 0 && (
          <Labelled id={`${ids}-area`} label={t('deliveryAreaLabel')}>
            <AreaChoice
              id={`${ids}-area`}
              zones={zones}
              value={area ? toSaleZone(area) : null}
              onPick={(zone) => {
                setConfirmingPaused(null)
                setAreaOff(false)
                setAreaId(toNumber(zone.zoneId))
              }}
              onClear={() => {
                setAreaId(null)
                setAreaOff(true)
              }}
            />
          </Labelled>
        )}
        {/* Then the street or a landmark: a pick fills the location, which
            picks the branch, and the street when it is still empty. Shown with Google Maps on */}
        <AddressSearchField
          onPick={(place) => {
            setPicked(null)
            setConfirmingPaused(null)
            setAreaOff(false)
            set({
              location: `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
              address: form.address.trim() ? form.address : (place.address ?? '').slice(0, DELIVERY_LIMITS.address),
              pinSource: 'Search',
            })
          }}
        />
        <Labelled
          id={`${ids}-street`}
          label={t('deliveryStreetLabel')}
          error={tried && errors.address ? t('deliveryNeedsStreet') : null}
        >
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
        {/* On the map or not: a search pick or an earlier address put it there, and it can be taken off */}
        {location === '' ? (
          <PinQualityLabel source='None' pinned={false} className='self-start' />
        ) : (
          <p className='type-detail flex items-center gap-1.5'>
            <PinQualityLabel source={form.pinSource} pinned />
            <button
              type='button'
              aria-label={t('callCentreOffMap')}
              className='hover:text-foreground rounded p-1'
              onClick={() => {
                setPicked(null)
                setConfirmingPaused(null)
                setAreaOff(false)
                set({ location: '', pinSource: null })
              }}
            >
              <X className='size-3.5' aria-hidden />
            </button>
          </p>
        )}

        {/* Which branch makes it: the picked area's, the nearest whose area takes the point in, or the agent's own pick */}
        <div className='type-detail flex flex-col gap-2' aria-live='polite'>
          {area && (
            <p className='border-primary bg-primary/5 flex min-h-12 items-center gap-2 rounded-lg border p-3'>
              <Store className='text-muted-foreground size-4 shrink-0' aria-hidden />
              <span className='min-w-0 flex-1'>
                <span className='font-medium'>{branchName(branchId)}</span>
                <span className='text-muted-foreground'>
                  {' · '}
                  {toNumber(area.fee) > 0 ? t('callCentreFeeIs', { fee: money(area.fee) }) : t('deliveryFree')}
                  {toNumber(area.minimumOrder) > 0 && (
                    <> · {t('deliveryMinimumIs', { amount: money(area.minimumOrder) })}</>
                  )}
                  {area.etaMinutes != null && (
                    <> · {t('deliveryAboutMinutes', { minutes: toNumber(area.etaMinutes) })}</>
                  )}
                </span>
                {!area.on && (
                  <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>
                    · {t('deliveryAreaOff')}
                  </span>
                )}
                {area.branchPaused && (
                  <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>
                    · {t('deliveryBranchPaused')}
                  </span>
                )}
              </span>
            </p>
          )}
          {reading ? (
            !area && (
              <p className='text-muted-foreground flex items-center gap-1.5'>
                <Loader2 className='size-3.5 animate-spin' aria-hidden />
                {t('callCentreFindingBranch')}
              </p>
            )
          ) : resolution.isError ? (
            <p className='flex items-center gap-2 text-amber-700 dark:text-amber-400'>
              {t('deliveryQuoteFailed')}
              <Button variant='outline' size='sm' className='h-8' onClick={() => resolution.refetch()}>
                {t('retry')}
              </Button>
            </p>
          ) : area ? null : offers.length === 0 ? (
            <p className='text-amber-700 dark:text-amber-400'>{t('callCentreNoBranchDelivers')}</p>
          ) : (
            <>
              {byHand && (
                <p className={location !== '' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                  {t(
                    location !== ''
                      ? 'callCentreOutsideAreas'
                      : searchOn
                        ? 'callCentrePickBranchSearch'
                        : 'callCentrePickBranch'
                  )}
                </p>
              )}
              {offers.map((b) => {
                const id = b.branchId
                const isChosen = id === branchId
                // The map point is in an area of this branch that is switched off for a while
                const offHere = pinArea(reaching, zones, id)
                return (
                  <button
                    key={id}
                    type='button'
                    aria-pressed={isChosen}
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
                      isChosen ? 'border-primary bg-primary/5' : 'bg-background'
                    )}
                  >
                    <Store className='text-muted-foreground size-4 shrink-0' aria-hidden />
                    <span className='min-w-0 flex-1'>
                      <span className='font-medium'>{branchName(id)}</span>
                      <span className='text-muted-foreground'>
                        {b.distanceMeters != null && <> · {distance(b.distanceMeters)}</>}
                        {' · '}
                        {b.fee > 0 ? t('callCentreFeeIs', { fee: money(b.fee) }) : t('deliveryFree')}
                      </span>
                      {b.paused && (
                        <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>
                          · {confirmingPaused === id ? t('callCentreTapAgainPaused') : t('deliveryBranchPaused')}
                        </span>
                      )}
                      {offHere && !offHere.on && (
                        <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>
                          · <bdi>{localized(offHere.name)}</bdi> {t('deliveryAreaOff')}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <Button size='lg' className='h-14 text-lg' onClick={deliver} disabled={reading || branchId == null}>
          {branchId != null ? t('callCentreDeliverFrom', { branch: branchName(branchId) }) : t('callCentreDeliver')}
        </Button>
      </section>

      <section className='flex flex-col gap-3 rounded-xl border p-4'>
        <h2 className='type-heading flex items-center gap-2'>
          <ShoppingBag className='size-5' aria-hidden />
          {t('callCentrePickupAt')}
        </h2>
        <div className='grid gap-2 sm:grid-cols-2'>
          {allBranches.map((b) => (
            <Button
              key={String(b.id)}
              variant='outline'
              className='h-12 justify-start text-base'
              onClick={() => pickup(Number(b.id))}
            >
              <Store className='size-4' aria-hidden />
              {localized(b.name)}
            </Button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Labelled({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p className='text-destructive type-detail' role='alert'>
          {error}
        </p>
      )}
    </div>
  )
}
