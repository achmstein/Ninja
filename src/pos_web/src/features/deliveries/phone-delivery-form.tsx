import { useCallback, useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bike,
  Check,
  ChevronDown,
  History,
  Loader2,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Send,
  Store,
  UserRound,
} from 'lucide-react'
import { getKnownDeliveryAddressesOptions } from '@/api/ordering/@tanstack/react-query.gen'
import type { DeliveryAlternative, KnownAddressView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useBranchName } from '@/features/branch/use-branch-name'
import { emptyDelivery, type PinSource, type SaleCustomer, type SaleDelivery, type SaleRider, type SaleSendTo } from '@/features/sale/cart'
import {
  DELIVERY_LIMITS,
  keptSendTo,
  MIN_PHONE_DIGITS,
  toSaleZone,
  toSendTo,
  validateDeliveryWhere,
  validateDeliveryWho,
  zoneIn,
} from '@/features/sale/sale-delivery'
import { apiClient, API_VERSION } from '@/lib/api-client'
import { useBrand, useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { digitCount, editablePhone, normalizePhone, showPhone } from '@/lib/phone'
import { isModuleOff } from '@/lib/problem'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { useAddressLine, useDistanceText } from './delivery-details'
import { AddressSearchField } from './address-search-field'
import { AreaChoice } from './area-picker'
import { outOfRangeKey } from './delivery-format'
import { LocationLink } from './location-link'
import { PinQualityLabel } from './pin-quality'
import { useRiders, useTillDeliveryQuote } from './use-deliveries'

type PhoneDeliveryFormProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The delivery already on the sale, to change; null to start one */
  initial: SaleDelivery | null
  /** Whoever the sale is for already: their name and number start the form */
  customer: SaleCustomer | null
  /** What the items come to, held against the branch's minimum (a warning only) */
  itemsTotal: number
  onSave: (delivery: SaleDelivery, customer: SaleCustomer) => void
}

/** The three steps of a phone call: who is calling, where it goes, then a look over it and send */
type Step = 'who' | 'where' | 'check'

/**
 * A delivery the till takes over the phone, in the order the call goes.
 * First the number: a caller who had deliveries before is found by it, with
 * their name when they have an account, and their earlier address is one tap
 * to the last step. Then, for a new address, where it goes: the branch's
 * named area (which sets the fee) and the street, building, floor and flat as
 * the caller says them, whatever Google knows. A pin on the map is an extra
 * for the rider, tucked away with the directions, and never changes the area.
 * Last, everything on one screen: the fee, anything to watch out for, a
 * nearer branch that could make it, and the rider to give it to.
 */
export function PhoneDeliveryForm({ open, onOpenChange, ...rest }: PhoneDeliveryFormProps) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Bike className='size-5' aria-hidden />
            {t('deliveryFormTitle')}
          </DialogTitle>
        </DialogHeader>
        {/* Rendered only while open, so every opening starts from the sale as it is now */}
        {open && <PhoneDeliveryBody {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

// Keycloak user as the identity route returns it (see sale/customer-dialog)
type IdentityUser = { id: string; username?: string; firstName?: string; lastName?: string; phoneNumber?: string; enabled?: boolean }

/** Digits enough to start offering the customers whose number holds them */
const SUGGEST_PHONE_DIGITS = 5

const toCustomer = (user: IdentityUser): SaleCustomer => ({
  id: user.id,
  name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || '',
  phone: user.phoneNumber ?? null,
})

/**
 * Who the number belongs to, as it is typed: the customer account that has
 * exactly this number, and until there is one, the few customers whose
 * numbers hold the digits typed so far, a tap away.
 */
function useAccountByPhone(phone: string, country: string, enabled: boolean) {
  const typed = digitCount(phone) >= SUGGEST_PHONE_DIGITS ? phone.trim() : ''
  const search = useDebounced(typed, 300)
  const query = useQuery({
    queryKey: ['identityUserSearch', search, 'deliveryPhone'],
    queryFn: async () =>
      (
        await apiClient.get<IdentityUser[]>('/api/identity/users', {
          params: { search, excludeRole: 'Admin,Owner,Cashier', merged: false, max: 5 },
        })
      ).data,
    enabled: enabled && search !== '',
    staleTime: 60_000,
  })
  const none = { account: null, suggestions: [] as SaleCustomer[], searching: false }
  if (!enabled || typed === '') return none
  if (search !== typed || query.isLoading) return { ...none, searching: true }
  const wanted = normalizePhone(phone, country)
  const users = (query.data ?? []).filter((u) => u.enabled !== false && !!u.phoneNumber)
  const exact = users.find((u) => normalizePhone(u.phoneNumber!, country) === wanted)
  return {
    account: exact ? toCustomer(exact) : null,
    suggestions: exact ? [] : users.slice(0, 4).map(toCustomer),
    searching: false,
  }
}

function PhoneDeliveryBody({ initial, customer, itemsTotal, onSave }: Omit<PhoneDeliveryFormProps, 'open' | 'onOpenChange'>) {
  const t = useT()
  const ids = useId()
  const localizedName = useLocalized()
  const moneyText = useMoney()
  const country = useBrand()?.locale.country ?? 'EG'
  // With a call centre the calls come through the hotline: a branch till keeps what it is rung for
  const callCentre = useFeatures().callCentre === true

  // Changing a delivery already made opens on its last step: everything is there to look over
  // The sale already says who it is for, number and all: nobody is asked twice, the form opens on where
  const [step, setStep] = useState<Step>(
    initial ? 'check' : customer?.name.trim() && digitCount(customer.phone ?? '') >= MIN_PHONE_DIGITS ? 'where' : 'who',
  )
  const [form, setForm] = useState<SaleDelivery>(() => initial ?? { ...emptyDelivery, phone: editablePhone(customer?.phone) })
  const [name, setName] = useState(customer?.name ?? '')
  // Opened past the first step, for a customer the sale already had
  const [cameWithCustomer] = useState(step === 'where')
  const theirAddresses = useKnownAddresses(cameWithCustomer ? (customer?.id ?? null) : null, cameWithCustomer ? (customer?.phone ?? '') : '', country)
  const [sendTo, setSendTo] = useState<SaleSendTo | null>(initial?.sendTo ?? null)
  const [rider, setRider] = useState<SaleRider | null>(initial?.rider ?? null)
  // The cashier took off the area the pin is in: it is not put back until the pin changes
  const [areaOff, setAreaOff] = useState(false)
  // A step's mistakes show once its Next was pressed; the phone's once it was left
  const [triedWho, setTriedWho] = useState(false)
  const [triedWhere, setTriedWhere] = useState(false)
  const [phoneLeft, setPhoneLeft] = useState(false)
  const set = (patch: Partial<SaleDelivery>) => setForm((f) => ({ ...f, ...patch }))

  // Who: the account the sale is for already, or the one this number belongs to
  const lookup = useAccountByPhone(form.phone, country, !customer?.id)
  const account: SaleCustomer | null = customer?.id ? customer : lookup.account
  const shownName = account && !name.trim() ? account.name : name

  // Where: the branch's named areas, and the terms for the area picked (or the pin when none is)
  const base = useTillDeliveryQuote()
  const areas = base.data
  const zones = areas?.zones ?? []
  const named = areas ? zoneIn(zones, form.zone?.id) : (form.zone ?? null)
  const quote = useTillDeliveryQuote(form.location, true, named?.id ?? null)
  const terms = quote.data
  const pasted = form.location.trim()
  // The pin is the one read from the text now in the field, never an earlier one's
  const pinned = pasted !== '' && quote.settled && quote.answeredFor === pasted && terms?.latitude != null && terms.longitude != null
  const reading = pasted !== '' && !quote.settled
  // With an area picked by name the answer names that area back: the pin's own area is asked apart,
  // so a pin that falls in another area can say so instead of being quietly overruled
  const pinQuote = useTillDeliveryQuote(form.location, named != null && pasted !== '', null)
  const pinArea =
    named && pinQuote.settled && pinQuote.data?.zoneId != null && toNumber(pinQuote.data.zoneId) !== named.id
      ? zoneIn(zones, pinQuote.data.zoneId)
      : null

  const alternatives = pinned && !callCentre ? (terms?.alternatives ?? []) : []
  const sending = keptSendTo(sendTo, alternatives, pinned)
  // No area picked by name: the one the pin fell in (drawn on the map), unless switched off or taken off
  const onMap =
    !named && !areaOff && pinned && terms?.zoneId != null && terms.zoneName != null && !terms.zoneOff
      ? toSaleZone({ ...terms, zoneId: terms.zoneId, name: terms.zoneName })
      : null
  const zone = sending ? null : (named ?? onMap)
  const minimum = sending ? sending.minimumOrder : toNumber(terms?.minimumOrder)
  const fee = sending ? sending.fee : toNumber(terms?.fee)

  // The caller shared where they are: that is the pin now, the area read from it again
  const onShared = useCallback((latitude: number, longitude: number) => {
    setAreaOff(false)
    setForm((f) => ({ ...f, location: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, pinSource: 'Shared' }))
  }, [])
  // How far the pin can be trusted, as the order will say it
  const pinSource: PinSource = pinned ? (form.pinSource && form.pinSource !== 'None' ? form.pinSource : 'Search') : 'None'

  const whoErrors = validateDeliveryWho(form.phone, shownName, !account)
  const whereErrors = validateDeliveryWhere(form)

  const toWhere = () => {
    setTriedWho(true)
    if (Object.keys(whoErrors).length === 0) setStep('where')
  }
  const toCheck = () => {
    setTriedWhere(true)
    if (Object.keys(whereErrors).length === 0) setStep('check')
  }
  const pickKnown = (a: KnownAddressView) => {
    setTriedWho(true)
    // Another address altogether: its own pin says the area again
    setAreaOff(false)
    setSendTo(null)
    setForm({
      ...emptyDelivery,
      address: a.address,
      building: a.building ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      directions: a.directions ?? '',
      phone: form.phone || editablePhone(a.phone),
      // Its pin as coordinates, which reads back as the same pin, and where it came from
      location: a.latitude != null && a.longitude != null ? `${toNumber(a.latitude)}, ${toNumber(a.longitude)}` : '',
      pinSource: (a.pinSource as PinSource | undefined) ?? null,
      locationShareToken: form.locationShareToken ?? null,
    })
    if (Object.keys(whoErrors).length === 0) setStep('check')
  }

  const save = () => {
    if (reading) return
    if (Object.keys(whoErrors).length > 0) return setStep('who')
    if (Object.keys(whereErrors).length > 0) return setStep('where')
    const phone = normalizePhone(form.phone, country)
    onSave(
      {
        ...form,
        address: form.address.trim(),
        phone,
        latitude: pinned ? toNumber(terms?.latitude) : null,
        longitude: pinned ? toNumber(terms?.longitude) : null,
        pinSource,
        sendTo: sending,
        zone,
        // Another branch's riders are its own: one picked here never follows the order there
        rider: sending ? null : rider,
      },
      account ? { ...account, name: shownName.trim() || account.name } : { id: null, name: shownName.trim(), phone },
    )
  }

  // The branch's own terms say whether it delivers at all; the ones for the area or pin follow as they change
  if (areas && !areas.delivers) return <p className='text-muted-foreground py-6 text-center'>{t('deliveryNotHere')}</p>
  if (base.isError && isModuleOff(base.error))
    return <p className='text-muted-foreground py-6 text-center'>{t('problemModuleOff')}</p>
  if (!areas && base.isError)
    return (
      <div className='flex flex-col items-center gap-3 py-6 text-center'>
        <p className='text-muted-foreground'>{t('deliveryTermsFailed')}</p>
        <Button variant='outline' className='h-11' onClick={() => base.refetch()}>
          {t('retry')}
        </Button>
      </div>
    )
  if (!areas)
    return (
      <div className='flex flex-col gap-3'>
        <Skeleton className='h-12' />
        <Skeleton className='h-12' />
      </div>
    )

  return (
    <div className='flex flex-col gap-4'>
      <Stepper
        step={step}
        done={{
          who: shownName.trim() || showPhone(normalizePhone(form.phone, country)),
          where: [zone ? localizedName(zone.name) : null, form.address.trim() || null].filter(Boolean).join(' · '),
        }}
        onGo={setStep}
      />

      {step === 'who' && (
        <WhoStep
          ids={ids}
          phone={form.phone}
          onPhone={(phone) => set({ phone })}
          phoneError={(triedWho || phoneLeft) && !!whoErrors.phone}
          onPhoneLeft={() => setPhoneLeft(digitCount(form.phone) > 0)}
          name={shownName}
          onName={setName}
          nameError={triedWho && !!whoErrors.name}
          account={account}
          suggestions={lookup.suggestions}
          searching={lookup.searching}
          onSuggestion={(c) => {
            set({ phone: editablePhone(c.phone) })
            setName(c.name)
          }}
          customerId={customer?.id ?? null}
          country={country}
          onKnown={pickKnown}
          onNext={toWhere}
        />
      )}

      {step === 'where' && (
        <>
          {/* The sale already said who it is for, so the first step was passed over: their addresses are offered here */}
          {cameWithCustomer && <KnownAddressList addresses={theirAddresses.addresses} onPick={pickKnown} />}
          {zones.length > 0 && (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor={`${ids}-area`}>{t('deliveryAreaLabel')}</Label>
              <AreaChoice
                id={`${ids}-area`}
                zones={zones}
                value={zone}
                onPick={(picked) => {
                  setSendTo(null)
                  setAreaOff(false)
                  set({ zone: toSaleZone(picked) })
                }}
                onClear={() => {
                  setAreaOff(true)
                  set({ zone: null })
                }}
              />
            </div>
          )}

          {/* The caller's own location, the way to the very door: asked for on WhatsApp while they are on the phone */}
          {(form.pinSource !== 'Customer' && form.pinSource !== 'Rider') || !pasted ? (
            <LocationLink
              phone={form.phone}
              token={form.locationShareToken ?? null}
              onToken={(token) => set({ locationShareToken: token })}
              onShared={onShared}
            />
          ) : null}

          <Field id={`${ids}-street`} label={t('deliveryStreetLabel')} error={triedWhere && whereErrors.address ? t('deliveryNeedsStreet') : null}>
            {(a) => (
              <Input
                {...a}
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                maxLength={DELIVERY_LIMITS.address}
                className='h-12 text-base'
                autoComplete='off'
                autoFocus={zones.length === 0}
              />
            )}
          </Field>

          <div className='grid grid-cols-3 gap-2'>
            {(
              [
                ['building', 'deliveryBuildingLabel'],
                ['floor', 'deliveryFloorLabel'],
                ['apartment', 'deliveryApartmentLabel'],
              ] as const
            ).map(([field, label]) => (
              <Field key={field} id={`${ids}-${field}`} label={t(label)}>
                {(a) => (
                  <Input
                    {...a}
                    value={form[field]}
                    onChange={(e) => set({ [field]: e.target.value })}
                    maxLength={DELIVERY_LIMITS[field]}
                    className='h-12 text-base'
                    autoComplete='off'
                  />
                )}
              </Field>
            ))}
          </div>

          <MoreForRider
            open={form.directions.trim() !== '' || pasted !== ''}
            directions={
              <Field id={`${ids}-directions`} label={t('deliveryDirectionsLabel')} error={triedWhere && whereErrors.tooLong ? t('problemTooLong') : null}>
                {(a) => (
                  <Input
                    {...a}
                    value={form.directions}
                    onChange={(e) => set({ directions: e.target.value })}
                    placeholder={t('deliveryDirectionsHint')}
                    maxLength={DELIVERY_LIMITS.directions}
                    className='h-12 text-base'
                    autoComplete='off'
                  />
                )}
              </Field>
            }
            map={
              <>
                {/* A pin for the rider: it never fills in the area, and the street only when it is empty */}
                <AddressSearchField
                  onPick={(place) => {
                    setAreaOff(false)
                    set({
                      location: `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
                      address: form.address.trim() ? form.address : (place.address ?? '').slice(0, DELIVERY_LIMITS.address),
                      // Found on the map: near the door, not the door
                      pinSource: 'Search',
                    })
                  }}
                />
                <PinState reading={reading} failed={quote.isError} pinned={pinned} distance={toNumber(terms?.distanceMeters)} onRetry={() => quote.refetch()} />
                {pinned && (
                  <Button variant='ghost' size='sm' className='h-9 self-start' onClick={() => set({ location: '' })}>
                    {t('deliveryPinRemove')}
                  </Button>
                )}
              </>
            }
          />

          {pinArea && (
            <Warning>
              <span className='flex flex-1 flex-wrap items-center gap-2'>
                <span className='flex-1'>{t('deliveryPinInOtherArea', { area: localizedName(pinArea.name) })}</span>
                <Button
                  variant='outline'
                  size='sm'
                  className='h-9'
                  onClick={() => set({ zone: pinArea })}
                >
                  {t('deliveryUseArea', { area: localizedName(pinArea.name) })}
                </Button>
              </span>
            </Warning>
          )}

          <div className='grid grid-cols-[auto_1fr] gap-2'>
            <Button variant='outline' size='lg' className='h-14' onClick={() => setStep('who')} aria-label={t('goBack')}>
              <ArrowLeft className='size-5 rtl:rotate-180' aria-hidden />
            </Button>
            <Button size='lg' className='h-14 text-lg' onClick={toCheck}>
              {t('deliveryNextTo', { step: t('deliveryStepCheck') })}
              <ArrowRight className='size-5 rtl:rotate-180' aria-hidden />
            </Button>
          </div>
        </>
      )}

      {step === 'check' && (
        <CheckStep
          name={shownName}
          phone={normalizePhone(form.phone, country)}
          form={form}
          zone={zone}
          zonesListed={zones.length > 0}
          pinned={pinned}
          pinSource={pinSource}
          sending={sending}
          alternatives={reading ? [] : alternatives}
          onSendTo={(to) => {
            setSendTo(to)
            // Areas belong to a branch: the one picked here does not follow the order to another
            if (to) set({ zone: null })
          }}
          warnings={
            terms && (
            <>
              {pinned && !terms.inRange && !sending && <Warning>{t(outOfRangeKey(terms), { km: toNumber(terms.radiusKm) })}</Warning>}
              {!sending && terms.zoneOff && terms.zoneName && (
                <Warning>
                  <span>
                    <bdi>{localizedName(terms.zoneName)}</bdi> · {t('deliveryAreaOff')}
                  </span>
                </Warning>
              )}
              {minimum > 0 && itemsTotal < minimum && <Warning>{t('deliveryUnderMinimum', { amount: moneyText(minimum) })}</Warning>}
            </>
            )
          }
          fee={sending || terms ? fee : null}
          eta={!sending && terms?.etaMinutes != null ? toNumber(terms.etaMinutes) : null}
          rider={rider}
          onRider={setRider}
          onEditWho={() => setStep('who')}
          onEditWhere={() => setStep('where')}
          reading={reading}
          onSave={save}
        />
      )}
    </div>
  )
}

/**
 * Where in the three steps the call is, seen at a glance: "Step 1 of 3", then
 * a bar per step with its icon and name, the current one glowing, the ones
 * behind ticked with what was said there (the caller, the street) and a tap
 * away to change it.
 */
function Stepper({
  step,
  done,
  onGo,
}: {
  step: Step
  /** What each step behind holds, said under its name */
  done: Partial<Record<Step, string>>
  onGo: (step: Step) => void
}) {
  const t = useT()
  const steps: { key: Step; label: string }[] = [
    { key: 'who', label: t('deliveryStepWho') },
    { key: 'where', label: t('deliveryStepWhere') },
    { key: 'check', label: t('deliveryStepCheck') },
  ]
  const at = steps.findIndex((s) => s.key === step)
  const icons = { who: UserRound, where: MapPin, check: Send } as const
  return (
    <nav aria-label={t('deliveryStepOf', { at: at + 1, count: steps.length })} className='flex flex-col gap-2'>
      {/* Said in words first, so a glance knows there is more to come */}
      <span className='text-muted-foreground type-label'>
        {t('deliveryStepOf', { at: at + 1, count: steps.length })}
      </span>
      <ol className='grid grid-cols-3 gap-2'>
        {steps.map((s, i) => {
          const past = i < at
          const now = i === at
          const Icon = past ? Check : icons[s.key]
          const body = (
            <>
              {/* The step's bar: filled behind and now, the current one with a soft glow */}
              <span
                aria-hidden
                className={cn(
                  'h-1.5 w-full rounded-full transition-colors duration-300',
                  past || now ? 'bg-primary' : 'bg-muted',
                )}
              />
              <span className='flex w-full min-w-0 items-center gap-1.5'>
                <Icon
                  className={cn('size-4 shrink-0', past || now ? 'text-primary' : 'text-muted-foreground/60')}
                  strokeWidth={past ? 3 : 2}
                  aria-hidden
                />
                <span
                  className={cn(
                    'truncate type-detail',
                    now ? 'text-foreground font-semibold' : past ? 'text-foreground font-medium' : 'text-muted-foreground',
                  )}
                >
                  {s.label}
                </span>
              </span>
              {past && done[s.key] ? (
                <bdi className='text-muted-foreground -mt-1 block w-full truncate ps-5.5 text-start type-caption'>{done[s.key]}</bdi>
              ) : null}
            </>
          )
          return (
            <li key={s.key} className='min-w-0' aria-current={now ? 'step' : undefined}>
              {past ? (
                <button
                  type='button'
                  onClick={() => onGo(s.key)}
                  className='hover:bg-muted/60 -m-1 flex w-[calc(100%+0.5rem)] min-w-0 flex-col items-start gap-2 rounded-md p-1 text-start'
                >
                  {body}
                </button>
              ) : (
                <div className='flex min-w-0 flex-col items-start gap-2'>{body}</div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Where this customer had deliveries before, and the addresses they saved in
 * the app: by their account when they have one, and by their number.
 */
function useKnownAddresses(customerId: string | null, phone: string, country: string) {
  const lookupPhone = useDebounced(digitCount(phone) >= MIN_PHONE_DIGITS ? normalizePhone(phone, country) : '', 400)
  const known = useQuery({
    ...getKnownDeliveryAddressesOptions({
      query: { 'api-version': API_VERSION, customerUserId: customerId ?? undefined, phone: lookupPhone || undefined },
    }),
    enabled: !!customerId || lookupPhone !== '',
  })
  return { known, addresses: known.data ?? [], lookupPhone }
}

/** A customer's earlier addresses, one tap each: the same address again is the commonest delivery there is */
function KnownAddressList({ addresses, onPick }: { addresses: KnownAddressView[]; onPick: (address: KnownAddressView) => void }) {
  const t = useT()
  const line = useAddressLine()
  if (addresses.length === 0) return null
  return (
    <div className='flex flex-col gap-2'>
      <span className='text-muted-foreground type-detail flex items-center gap-1.5 font-medium'>
        <History className='size-4' aria-hidden />
        {t('deliveryKnownAddresses')}
      </span>
      {addresses.map((a) => (
        <button
          key={[a.address, a.building, a.floor, a.apartment, a.latitude, a.longitude].join('|')}
          type='button'
          onClick={() => onPick(a)}
          className='hover:bg-muted flex min-h-16 items-center gap-3 rounded-lg border p-3 text-start'
        >
          <MapPin className='text-muted-foreground size-5 shrink-0' aria-hidden />
          <span className='min-w-0 flex-1'>
            <span className='block font-medium'>
              {a.label && <>{a.label} · </>}
              {line(a)}
            </span>
            {a.directions && <span className='text-muted-foreground type-detail block truncate italic'>"{a.directions}"</span>}
          </span>
          <span className='text-primary type-detail flex shrink-0 items-center gap-1 font-semibold'>
            <Check className='size-4' aria-hidden />
            {t('deliverySameAddress')}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Step one: the number first, as the call starts; a caller who had deliveries before is one tap away */
function WhoStep({
  ids,
  phone,
  onPhone,
  phoneError,
  onPhoneLeft,
  name,
  onName,
  nameError,
  account,
  suggestions,
  searching,
  onSuggestion,
  customerId,
  country,
  onKnown,
  onNext,
}: {
  ids: string
  phone: string
  onPhone: (phone: string) => void
  phoneError: boolean
  onPhoneLeft: () => void
  name: string
  onName: (name: string) => void
  nameError: boolean
  account: SaleCustomer | null
  /** Customers whose numbers hold the digits typed so far */
  suggestions: SaleCustomer[]
  searching: boolean
  onSuggestion: (customer: SaleCustomer) => void
  customerId: string | null
  country: string
  onKnown: (address: KnownAddressView) => void
  onNext: () => void
}) {
  const t = useT()
  const { known, addresses, lookupPhone } = useKnownAddresses(customerId ?? account?.id ?? null, phone, country)
  const whole = digitCount(phone) >= MIN_PHONE_DIGITS
  // Who the number is, said under it: a customer, someone delivered to before, or a new caller
  const settled = whole && !searching && !known.isFetching && lookupPhone !== ''

  return (
    <>
      <Field id={`${ids}-phone`} label={t('deliveryPhoneLabel')} error={phoneError ? t('deliveryPhoneInvalid') : null}>
        {(a) => (
          <Input
            {...a}
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            onBlur={onPhoneLeft}
            onKeyDown={(e) => e.key === 'Enter' && onNext()}
            className='h-12 text-base tabular-nums'
            inputMode='tel'
            dir='ltr'
            autoComplete='off'
            autoFocus
          />
        )}
      </Field>

      <div aria-live='polite' className='-mt-2 flex flex-col gap-2 empty:hidden'>
        {account ? (
          <p className='flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 type-detail font-medium text-emerald-700 dark:text-emerald-400'>
            <UserRound className='size-4 shrink-0' aria-hidden />
            <span className='min-w-0 truncate'>
              <bdi>{account.name}</bdi> · {t('deliveryKnownCustomer')}
            </span>
          </p>
        ) : suggestions.length > 0 ? (
          <div className='flex flex-col overflow-hidden rounded-lg border'>
            {suggestions.map((c) => (
              <button
                key={c.id}
                type='button'
                onClick={() => onSuggestion(c)}
                className='hover:bg-muted flex min-h-12 items-center gap-2 border-b px-3 py-2 text-start last:border-b-0'
              >
                <UserRound className='text-muted-foreground size-4 shrink-0' aria-hidden />
                <bdi className='min-w-0 flex-1 truncate font-medium'>{c.name}</bdi>
                <span dir='ltr' className='text-muted-foreground shrink-0 type-detail tabular-nums'>
                  {showPhone(c.phone ?? '')}
                </span>
              </button>
            ))}
          </div>
        ) : settled && addresses.length > 0 ? (
          <p className='bg-muted flex items-center gap-2 rounded-lg px-3 py-2 type-detail font-medium'>
            <History className='size-4 shrink-0' aria-hidden />
            {t('deliveryCalledBefore')}
          </p>
        ) : settled ? (
          <p className='bg-muted text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-2 type-detail'>
            <Plus className='size-4 shrink-0' aria-hidden />
            {t('deliveryNewCaller')}
          </p>
        ) : null}
      </div>

      <Field id={`${ids}-name`} label={t('deliveryCustomerName')} error={nameError ? t('deliveryNeedsName') : null}>
        {(a) => (
          <div className='relative'>
            <Input
              {...a}
              value={name}
              onChange={(e) => onName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onNext()}
              className={cn('h-12 text-base', account && 'pe-10')}
              autoComplete='off'
            />
            {account && (
              <UserRound
                className='text-primary absolute end-3 top-1/2 size-5 -translate-y-1/2'
                aria-label={t('deliveryKnownCustomer')}
              />
            )}
          </div>
        )}
      </Field>

      {known.isFetching && addresses.length === 0 && <Skeleton className='h-16' />}

      <KnownAddressList addresses={addresses} onPick={onKnown} />

      <Button size='lg' variant={addresses.length > 0 ? 'outline' : 'default'} className='h-14 text-lg' onClick={onNext}>
        {addresses.length > 0 ? (
          <>
            <Plus className='size-5' aria-hidden />
            {t('deliveryNewAddress')}
          </>
        ) : (
          <>
            {t('deliveryNextTo', { step: t('deliveryStepWhere') })}
            <ArrowRight className='size-5 rtl:rotate-180' aria-hidden />
          </>
        )}
      </Button>
    </>
  )
}

/** Directions and a pin on the map: for the rider, and folded away until wanted */
function MoreForRider({ open: startOpen, directions, map }: { open: boolean; directions: ReactNode; map: ReactNode }) {
  const t = useT()
  const [open, setOpen] = useState(startOpen)
  if (!open)
    return (
      <Button variant='ghost' className='text-muted-foreground h-11 self-start' onClick={() => setOpen(true)}>
        <ChevronDown className='size-4' aria-hidden />
        {t('deliveryMoreForRider')}
      </Button>
    )
  return (
    <div className='flex flex-col gap-3 rounded-lg border border-dashed p-3'>
      {directions}
      <div className='flex flex-col gap-1.5'>
        <span className='text-muted-foreground flex items-center gap-1.5 type-detail font-medium'>
          <MapPinned className='size-4' aria-hidden />
          {t('deliveryPinLabel')}
        </span>
        {map}
      </div>
    </div>
  )
}

function PinState({
  reading,
  failed,
  pinned,
  distance: meters,
  onRetry,
}: {
  reading: boolean
  failed: boolean
  pinned: boolean
  distance: number
  onRetry: () => void
}) {
  const t = useT()
  const distance = useDistanceText()
  if (reading)
    return (
      <span className='text-muted-foreground flex items-center gap-1.5 type-detail' aria-live='polite'>
        <Loader2 className='size-3.5 animate-spin' aria-hidden />
        {t('deliveryLocationReading')}
      </span>
    )
  if (failed)
    return (
      <span className='flex items-center gap-2 type-detail text-amber-700 dark:text-amber-400'>
        {t('deliveryQuoteFailed')}
        <Button variant='outline' size='sm' className='h-8' onClick={onRetry}>
          {t('retry')}
        </Button>
      </span>
    )
  if (pinned)
    return (
      <span className='flex items-center gap-1.5 type-detail' aria-live='polite'>
        <MapPin className='size-3.5' aria-hidden />
        {t('deliveryLocationFound', { distance: distance(meters) })}
      </span>
    )
  return <span className='text-muted-foreground type-detail'>{t('deliveryPinOptional')}</span>
}

/** Step three: all of it on one screen, the rider to give it to, and Send */
function CheckStep({
  name,
  phone,
  form,
  zone,
  zonesListed,
  pinned,
  pinSource,
  sending,
  alternatives,
  onSendTo,
  warnings,
  fee,
  eta,
  rider,
  onRider,
  onEditWho,
  onEditWhere,
  reading,
  onSave,
}: {
  name: string
  phone: string
  form: SaleDelivery
  zone: { name: { en: string | null; ar: string | null } } | null
  zonesListed: boolean
  pinned: boolean
  pinSource: PinSource
  sending: SaleSendTo | null
  alternatives: DeliveryAlternative[]
  onSendTo: (to: SaleSendTo | null) => void
  warnings: ReactNode
  /** Null while the terms for the area or pin are read */
  fee: number | null
  eta: number | null
  rider: SaleRider | null
  onRider: (rider: SaleRider | null) => void
  onEditWho: () => void
  onEditWhere: () => void
  reading: boolean
  onSave: () => void
}) {
  const t = useT()
  const money = useMoney()
  const localized = useLocalized()
  const line = useAddressLine()
  const branchName = useBranchName()
  const details = line({ building: form.building, floor: form.floor, apartment: form.apartment })

  return (
    <>
      <div className='flex flex-col divide-y rounded-lg border'>
        <SummaryRow onEdit={onEditWho} editLabel={t('deliveryChange')}>
          <span className='block type-heading'>{name}</span>
          <span className='text-muted-foreground type-detail'>{showPhone(phone)}</span>
        </SummaryRow>
        <SummaryRow onEdit={onEditWhere} editLabel={t('deliveryChange')}>
          {zone && (
            <span className='text-muted-foreground block type-detail font-medium'>
              <bdi>{localized(zone.name)}</bdi>
            </span>
          )}
          <span className='block type-heading'>{form.address}</span>
          {details && <span className='text-muted-foreground block type-detail'>{details}</span>}
          {form.directions.trim() && <span className='text-muted-foreground block type-detail italic'>"{form.directions.trim()}"</span>}
          <PinQualityLabel source={pinSource} pinned={pinned} className='mt-1.5' />
        </SummaryRow>
      </div>

      <div className='flex flex-col gap-1.5'>
        {zonesListed && !zone && !sending && (
          <Warning>
            <span className='flex flex-1 flex-wrap items-center gap-2'>
              <span className='flex-1'>{t('deliveryNoAreaPicked')}</span>
              <Button variant='outline' size='sm' className='h-9' onClick={onEditWhere}>
                {t('deliveryPickArea')}
              </Button>
            </span>
          </Warning>
        )}
        {warnings}
        <div className='flex justify-between type-detail'>
          <span className='text-muted-foreground'>
            {t('deliveryFee')}
            {eta != null && <> · {t('deliveryAboutMinutes', { minutes: eta })}</>}
          </span>
          <span className='font-medium tabular-nums'>
            {fee == null ? <Loader2 className='size-4 animate-spin' aria-hidden /> : fee > 0 ? money(fee) : t('deliveryFree')}
          </span>
        </div>
      </div>

      {alternatives.length > 0 && <NearerBranches alternatives={alternatives} chosen={sending?.branchId ?? null} onChoose={onSendTo} />}

      {!sending && <RiderChoice value={rider} onChange={onRider} />}

      <Button size='lg' className='h-14 text-lg' onClick={onSave} disabled={reading}>
        {reading && <Loader2 className='size-5 animate-spin' aria-hidden />}
        {sending ? t('deliverySaveSend', { branch: branchName(sending.branchId) }) : t('deliverySave')}
      </Button>
    </>
  )
}

function SummaryRow({ children, onEdit, editLabel }: { children: ReactNode; onEdit: () => void; editLabel: string }) {
  return (
    <div className='flex items-start gap-2 p-3'>
      <div className='min-w-0 flex-1'>{children}</div>
      <Button variant='ghost' size='sm' className='h-9 shrink-0 gap-1.5' onClick={onEdit}>
        <Pencil className='size-3.5' aria-hidden />
        {editLabel}
      </Button>
    </div>
  )
}

/**
 * Who takes it, picked while the call is still on: the branch's riders, free
 * ones first, or Later to give it from Deliveries once it is ready.
 */
function RiderChoice({ value, onChange }: { value: SaleRider | null; onChange: (rider: SaleRider | null) => void }) {
  const t = useT()
  const riders = useRiders(true)
  const list = [...(riders.data ?? [])].sort((a, b) => rank(a) - rank(b))
  if (riders.isLoading) return <Skeleton className='h-14' />
  if (list.length === 0) return null
  return (
    <div className='flex flex-col gap-1.5'>
      <span className='text-muted-foreground type-detail font-medium'>{t('deliveryGiveTo')}</span>
      <div className='flex flex-wrap gap-2' role='radiogroup' aria-label={t('deliveryGiveTo')}>
        <Chip chosen={value == null} onClick={() => onChange(null)} title={t('deliveryRiderLater')} />
        {list.map((r) => {
          const out = toNumber(r.out)
          const status = !r.signedIn ? t('riderNotSignedIn') : !r.onDuty ? t('riderOffDuty') : out > 0 ? t('riderOut', { count: out }) : t('riderFree')
          return (
            <Chip
              key={r.userId}
              chosen={value?.userId === r.userId}
              onClick={() => onChange({ userId: r.userId, name: r.name ?? '' })}
              title={r.name ?? ''}
              status={status}
              free={!!r.onDuty && out === 0}
            />
          )
        })}
      </div>
    </div>
  )
}

/** Free and on duty first, then on duty and out, then the rest */
function rank(r: { onDuty?: boolean; signedIn?: boolean; out?: number | string }) {
  if (!r.onDuty || !r.signedIn) return 2
  return toNumber(r.out) > 0 ? 1 : 0
}

function Chip({ chosen, onClick, title, status, free }: { chosen: boolean; onClick: () => void; title: string; status?: string; free?: boolean }) {
  return (
    <button
      type='button'
      role='radio'
      aria-checked={chosen}
      onClick={onClick}
      className={cn(
        'flex min-h-12 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-start',
        chosen ? 'border-primary bg-primary/5 ring-primary ring-1' : 'hover:bg-muted',
      )}
    >
      <span className='flex items-center gap-1.5 font-medium'>
        {free != null && <span aria-hidden className={cn('size-2 rounded-full', free ? 'bg-emerald-500' : 'bg-muted-foreground')} />}
        {title}
      </span>
      {status && <span className='text-muted-foreground type-caption'>{status}</span>}
    </button>
  )
}

/** A labelled field whose error is announced and tied to its input */
function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string | null
  children: (a: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, ...(error ? { 'aria-invalid': true, 'aria-describedby': `${id}-error` } : {}) })}
      {error && (
        <p id={`${id}-error`} className='text-destructive type-detail' role='alert'>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The branches nearer the caller that deliver there, nearest first: how far
 * and for what fee, with Send. A paused branch says so and takes a second tap.
 * The one chosen says the order goes there, with the way back.
 */
function NearerBranches({
  alternatives,
  chosen,
  onChoose,
}: {
  alternatives: DeliveryAlternative[]
  chosen: number | null
  onChoose: (sendTo: SaleSendTo | null) => void
}) {
  const t = useT()
  const money = useMoney()
  const distance = useDistanceText()
  const branchName = useBranchName()
  const [confirming, setConfirming] = useState<number | null>(null)
  return (
    <div className='flex flex-col gap-2' aria-live='polite'>
      {alternatives.map((a) => {
        const id = toNumber(a.branchId)
        const branch = branchName(id)
        const fee = toNumber(a.fee)
        const isChosen = chosen === id
        if (chosen != null && !isChosen) return null
        return (
          <div key={id} className={cn('flex flex-col gap-2 rounded-lg border p-3 type-detail', isChosen ? 'border-primary bg-primary/5' : 'bg-background')}>
            <p className='flex items-start gap-2'>
              <Store className='text-muted-foreground mt-0.5 size-4 shrink-0' aria-hidden />
              <span className='min-w-0 flex-1'>
                {isChosen
                  ? t('deliveryWillSend', { branch })
                  : t('deliveryNearerBranch', { branch, distance: distance(toNumber(a.distanceMeters)), fee: fee > 0 ? money(fee) : t('deliveryFree') })}
                {a.paused && <span className='ms-1.5 font-medium text-amber-700 dark:text-amber-400'>· {t('deliveryBranchPaused')}</span>}
              </span>
            </p>
            {isChosen ? (
              <Button variant='outline' className='h-11 self-start' onClick={() => onChoose(null)}>
                {t('deliveryKeepHere')}
              </Button>
            ) : (
              <Button
                variant={confirming === id ? 'default' : 'secondary'}
                className='h-11 self-start'
                onClick={() => {
                  // A paused branch stopped its customers' orders: the cashier is asked once more
                  if (a.paused && confirming !== id) {
                    setConfirming(id)
                    return
                  }
                  setConfirming(null)
                  onChoose(toSendTo(a))
                }}
              >
                <Send className='size-4' aria-hidden />
                {a.paused && confirming === id ? t('deliverySendToPaused', { branch }) : t('deliverySendTo', { branch })}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <div className='flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 type-detail text-amber-700 dark:text-amber-400'>
      <AlertTriangle className='size-4 shrink-0' aria-hidden />
      {children}
    </div>
  )
}
