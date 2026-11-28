import { useState } from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Home,
  Briefcase,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import {
  addMyAddressMutation,
  deleteMyAddressMutation,
  updateMyAddressMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
import { useDeliveryStore, type DeliveryAddress } from '@/stores/delivery-store'
import { useGuestStore } from '@/stores/guest-store'
import { addressRow, labelKind, shownLabel, storedLabel, type LabelKind } from '@/lib/address-line'
import { API_VERSION } from '@/lib/api-client'
import { useSelectedBranch } from '@/lib/branch'
import { showPhone, useBrand, usePhoneRule } from '@/lib/brand'
import { addressBody, fromSaved, useMyAddresses } from '@/lib/delivery'
import { pointOf, useLocationPermission, useMyLocation, type LatLng } from '@/lib/geo'
import { useLanguage, useT } from '@/lib/i18n'
import { formatPhone, isValidPhone, normalizePhone } from '@/lib/phone'
import { problemMessage } from '@/lib/problem'
import { getMyProfile } from '@/lib/services/identity'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { pillAction } from '@/components/ui/ninja-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AddressSearch } from './address-search'
import { DetailChips } from './detail-chips'
import { MapPicker } from './map-pin'

/** Where the map opens when neither the customer nor the branch is placed: the middle of the business's country */
const COUNTRY_CENTRES: Record<string, LatLng> = {
  EG: { lat: 30.0444, lng: 31.2357 },
  SA: { lat: 24.7136, lng: 46.6753 },
  AE: { lat: 25.2048, lng: 55.2708 },
}

/**
 * Where the order is brought: the customer's addresses (saved on their
 * account, or the last one on this device for a guest), one tap to pick,
 * and a new one pinned on the map with the words that find the door. Opened
 * from the tray, and from the profile's "My addresses" (`manage`: picking
 * one there edits it rather than choosing it).
 */
export function AddressSheet({
  open,
  onOpenChange,
  manage = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  manage?: boolean
}) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const auth = useAuth()
  const { address: chosen, setAddress } = useDeliveryStore()
  const { data: saved = [], isLoading } = useMyAddresses()
  // The form, for a new address or one being changed; null shows the list
  const [editing, setEditing] = useState<DeliveryAddress | 'new' | null>(null)
  const words = { building: t('deliveryBuilding'), floor: t('deliveryFloor'), apartment: t('deliveryApartment') }
  const labels = { home: t('deliveryLabelHome'), work: t('deliveryLabelWork') }

  // A guest has only the device's one; a customer with none goes straight to adding one
  const list: DeliveryAddress[] = auth.isAuthenticated ? saved.map(fromSaved) : chosen ? [chosen] : []
  const empty = !isLoading && list.length === 0

  // Closed, it opens next time on the list again
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (!open) setEditing(null)
  }

  const form = editing ?? (open && empty && !manage ? 'new' : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {form === 'new'
              ? t('deliveryNewAddress')
              : form
                ? t('deliveryEditAddress')
                : manage
                  ? t('myAddresses')
                  : t('deliveryAddressTitle')}
          </SheetTitle>
        </SheetHeader>
        {form ? (
          <AddressForm
            key={form === 'new' ? 'new' : (form.id ?? 'device')}
            initial={form === 'new' ? null : form}
            // Backed out of a new address's map: to the list, or shut when there is nothing on it to pick
            onCancel={() => (editing != null && (!empty || manage) ? setEditing(null) : onOpenChange(false))}
            onDone={(address) => {
              if (!manage) {
                if (address) setAddress(address)
                onOpenChange(false)
              } else {
                setEditing(null)
              }
            }}
          />
        ) : (
          <div className='flex flex-col gap-1.5'>
            {isLoading && auth.isAuthenticated ? (
              <div className='text-muted-foreground grid h-24 place-items-center'>
                <Loader2 className='size-5 animate-spin' />
              </div>
            ) : (
              list.map((address) => {
                const on = !manage && chosen != null && sameAddress(chosen, address)
                const row = addressRow(address, shownLabel(address.label, labels), words, language)
                return (
                  <button
                    key={address.id ?? `device-${address.latitude},${address.longitude}`}
                    type='button'
                    onClick={() => {
                      if (manage) {
                        setEditing(address)
                        return
                      }
                      setAddress(address)
                      onOpenChange(false)
                    }}
                    aria-pressed={on}
                    className={cn(
                      'flex min-h-16 items-center gap-3 rounded-[1.25rem] px-4 py-3 text-start',
                      on && 'bg-muted'
                    )}
                  >
                    <span className='bg-muted grid size-10 shrink-0 place-items-center rounded-full'>
                      <LabelIcon kind={labelKind(address.label)} />
                    </span>
                    <span className='flex min-w-0 flex-1 flex-col'>
                      <span className='text-body truncate font-semibold'>{row.title}</span>
                      {/* Only when there is more to say than the line above already does */}
                      {row.line && <span className='text-muted-foreground text-caption line-clamp-2'>{row.line}</span>}
                    </span>
                    {on ? (
                      <Check className='size-5 shrink-0' />
                    ) : (
                      manage && <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' />
                    )}
                  </button>
                )
              })
            )}
            {manage && empty && <p className='text-muted-foreground text-note px-1 py-4'>{t('myAddressesEmpty')}</p>}
            <button
              type='button'
              onClick={() => setEditing('new')}
              className='text-body flex min-h-14 items-center gap-3 rounded-[1.25rem] px-4 text-start font-semibold'
            >
              <span className='bg-primary text-primary-foreground grid size-10 shrink-0 place-items-center rounded-full'>
                <Plus className='size-5' />
              </span>
              {t('deliveryNewAddress')}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function sameAddress(a: DeliveryAddress, b: DeliveryAddress) {
  return a.id != null
    ? a.id === b.id
    : a.latitude === b.latitude && a.longitude === b.longitude && a.address === b.address
}

function LabelIcon({ kind }: { kind: LabelKind }) {
  if (kind === 'home') return <Home className='size-5' />
  if (kind === 'work') return <Briefcase className='size-5' />
  return <MapPin className='size-5' />
}

/**
 * One address, in two steps the way delivery apps ask: the map alone first
 * (move it until the pin is on the door, then confirm), then the few words
 * a rider needs. Only the area and street (or a landmark, where streets have
 * no names) is asked for; building, floor and apartment are for those who
 * have them. A new one is confirmed only once its pin was put somewhere
 * (moved, or found by "use my location"): the map's starting point is the
 * branch, and a rider sent there finds nobody. A signed-in customer's number
 * is their account's, shown and changed only if they ask; theirs is saved on
 * their account, a guest's stays on the device. An address being changed
 * opens on its words, the map one tap away. Removing one is at the foot of
 * its form, asked once more.
 */
function AddressForm({
  initial,
  onDone,
  onCancel,
}: {
  initial: DeliveryAddress | null
  onDone: (address: DeliveryAddress | null) => void
  /** Backed out of the map before a new address's pin was confirmed */
  onCancel: () => void
}) {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const branch = useSelectedBranch()
  const country = useBrand()?.locale.country ?? 'EG'
  // A mobile as the business's country writes one, to show in the field
  const phonePlaceholder = usePhoneRule((s) => s.placeholder)
  const guestPhone = useGuestStore((s) => s.contact?.phone ?? '')
  const guestName = useGuestStore((s) => s.contact?.name ?? '')
  const isGuest = !auth.isAuthenticated
  // A new address takes the GPS's own fix, not the coarse one the branch list may have had: at once where
  // the browser gives it already, else on the customer's word, once they have read why (under the map)
  const location = useMyLocation(initial == null, { precise: true, quiet: true })
  const permission = useLocationPermission()
  const explain =
    initial == null && !location.here && location.canLocate && (permission === 'prompt' || permission === null)

  const [point, setPoint] = useState<LatLng>(() =>
    initial
      ? { lat: initial.latitude, lng: initial.longitude }
      : (location.here ?? pointOf(branch) ?? COUNTRY_CENTRES[country] ?? COUNTRY_CENTRES.EG)
  )
  // The pin was put on a door: an address being changed already was; a new one once moved or located
  const [pinned, setPinned] = useState(initial != null || location.here != null)
  // The map flies to where the customer is each time a fix comes (the coarse one, then the GPS's),
  // until the customer moves it themselves; "Use my location" hands it back to the fix
  const [flyTo, setFlyTo] = useState<LatLng | null>(null)
  const [moved, setMoved] = useState(initial != null)
  const [flownTo, setFlownTo] = useState<LatLng | null>(initial == null ? location.here : null)
  if (!moved && location.here && location.here !== flownTo) {
    setFlownTo(location.here)
    setFlyTo(location.here)
    setPinned(true)
  }

  const [street, setStreet] = useState(initial?.address ?? '')
  const [building, setBuilding] = useState(initial?.building ?? '')
  const [floor, setFloor] = useState(initial?.floor ?? '')
  const [apartment, setApartment] = useState(initial?.apartment ?? '')
  const [directions, setDirections] = useState(initial?.directions ?? '')
  // What the customer typed; until then their own number (a guest's checkout one, or the account's)
  const [typedPhone, setPhone] = useState<string | null>(() => {
    const known = initial?.phone ?? (guestPhone || null)
    // Shown the local way; read however it is typed or a phone's autofill hands it over
    return known == null ? null : formatPhone(known, country)
  })
  // A guest's name, asked here beside the rider's number: the two are the
  // guest's contact for the order, so checkout need not ask for them again
  const [name, setName] = useState(guestName)
  const [kind, setKind] = useState<LabelKind>(labelKind(initial?.label))
  // A name the customer gave it before is kept; only Home and Work are offered now
  const labelText = labelKind(initial?.label) === 'other' ? (initial?.label ?? '') : ''
  const [step, setStep] = useState<'pin' | 'details'>(initial ? 'details' : 'pin')
  const [pinTried, setPinTried] = useState(false)
  const [editPhone, setEditPhone] = useState(false)
  const [tried, setTried] = useState(false)
  const [removing, setRemoving] = useState(false)

  const profile = useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
    enabled: auth.isAuthenticated && typedPhone == null,
    staleTime: 5 * 60_000,
  })
  const phone = typedPhone ?? profile.data?.phoneNumber?.trim() ?? ''

  const refresh = () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyAddresses' }] })
  const add = useMutation({ ...addMyAddressMutation(), onSuccess: refresh })
  const update = useMutation({ ...updateMyAddressMutation(), onSuccess: refresh })
  const remove = useMutation({ ...deleteMyAddressMutation(), onSuccess: refresh })
  const busy = add.isPending || update.isPending

  const phoneOk = isValidPhone(phone, country)
  const streetOk = street.trim().length > 0
  const nameOk = !isGuest || name.trim().length > 0
  const problem = !pinned
    ? t('deliveryNeedPin')
    : !streetOk
      ? t('deliveryNeedStreet')
      : !nameOk
        ? t('deliveryNeedName')
        : !phoneOk
          ? t('deliveryNeedPhone')
          : null

  // The account's number is shown, not asked for; a field only for a guest, on request, or when there is none that works
  const phoneField = isGuest || editPhone || (!phoneOk && !profile.isLoading)

  const confirmPin = () => {
    if (!pinned) {
      setPinTried(true)
      return
    }
    // The map is the customer's now: coming back to it starts where they left it, not at a fix
    setMoved(true)
    setFlyTo(null)
    setConfirmed(true)
    setStep('details')
  }

  // Back from the whole map: to the words, once the pin was confirmed before; a new one goes back to where it came from
  const [confirmed, setConfirmed] = useState(initial != null)
  const leavePin = () => (confirmed ? setStep('details') : onCancel())

  const save = async () => {
    setTried(true)
    if (problem) return
    const address: DeliveryAddress = {
      id: initial?.id,
      label: storedLabel(kind, labelText),
      latitude: point.lat,
      longitude: point.lng,
      address: street.trim(),
      building: building.trim() || null,
      floor: floor.trim() || null,
      apartment: apartment.trim() || null,
      directions: directions.trim() || null,
      // In the one international form, however it was typed
      phone: normalizePhone(phone, country),
    }
    if (isGuest) {
      // The guest's contact is now known: placing the order goes straight through
      useGuestStore.getState().setContact({ name: name.trim(), phone: normalizePhone(phone, country) })
      onDone(address)
      return
    }
    try {
      const body = addressBody(address)
      const savedAddress =
        address.id != null
          ? await update.mutateAsync({ path: { addressId: address.id }, body, query: { 'api-version': API_VERSION } })
          : await add.mutateAsync({ body, query: { 'api-version': API_VERSION } })
      toast.success(t('deliveryAddressSaved'))
      onDone(fromSaved(savedAddress))
    } catch (error) {
      toast.error(problemMessage(error, t, 'deliveryAddressNotSaved'))
    }
  }

  const forget = async () => {
    if (initial?.id == null) return
    try {
      await remove.mutateAsync({ path: { addressId: initial.id }, query: { 'api-version': API_VERSION } })
      const { address, setAddress } = useDeliveryStore.getState()
      if (address?.id === initial.id) setAddress(null)
      toast.success(t('deliveryAddressRemoved'))
      onDone(null)
    } catch (error) {
      toast.error(problemMessage(error, t, 'deliveryAddressNotRemoved'))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <form
      className='flex flex-col gap-3'
      onSubmit={(e) => {
        e.preventDefault()
        if (step === 'pin') confirmPin()
        else void save()
      }}
    >
      {step === 'pin' ? (
        // The map alone, the whole screen: the one thing to do is put the pin on the door. Its own
        // layer over the sheet, so nothing of the sheet's slide holds it in
        <SheetPrimitive.Root open onOpenChange={(open) => !open && leavePin()}>
          <SheetPrimitive.Portal>
            <SheetPrimitive.Content
              aria-describedby={undefined}
              className='bg-background fixed inset-0 z-[100] flex flex-col outline-none'
            >
              <SheetPrimitive.Title className='sr-only'>{t('deliveryConfirmPin')}</SheetPrimitive.Title>
              <div className='relative min-h-0 flex-1'>
                <MapPicker
                  start={point}
                  to={flyTo}
                  onSettle={(settled, byUser) => {
                    setPoint(settled)
                    if (byUser) {
                      setPinned(true)
                      setMoved(true)
                    }
                  }}
                  className='absolute inset-0 h-full rounded-none'
                />
                {/* Back, and a street named rather than found, on the map itself: the map flies there, and the pin is then put on the door */}
                <div className='absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex items-start gap-2'>
                  <button
                    type='button'
                    onClick={leavePin}
                    aria-label={t('back')}
                    className='bg-background text-foreground grid size-11 shrink-0 place-items-center rounded-full shadow-md'
                  >
                    <ArrowLeft className='size-5 rtl:rotate-180' />
                  </button>
                  <div className='min-w-0 flex-1'>
                    <AddressSearch
                      near={pointOf(branch)}
                      onPick={(place) => {
                        setFlyTo({ lat: place.lat, lng: place.lng })
                        setPinned(true)
                        setMoved(true)
                        if (!street.trim() && place.address) setStreet(place.address)
                      }}
                    />
                  </div>
                </div>
                {location.canLocate && (
                  <button
                    type='button'
                    onClick={() => {
                      setMoved(false)
                      // Back to the fix there is at once; a fresher one follows it
                      if (location.here) setFlyTo({ ...location.here })
                      location.locate()
                    }}
                    disabled={location.locating}
                    className='bg-background text-foreground absolute end-3 bottom-3 grid size-12 place-items-center rounded-full shadow-md'
                    aria-label={t('useMyLocation')}
                  >
                    {location.locating ? (
                      <Loader2 className='size-5 animate-spin' />
                    ) : (
                      <LocateFixed className='size-5' />
                    )}
                  </button>
                )}
              </div>
              <div className='flex flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]'>
                {explain && !moved ? (
                  // Why the app would like the position, before the browser asks for it
                  <button
                    type='button'
                    onClick={() => location.locate()}
                    disabled={location.locating}
                    className='bg-primary/10 text-foreground text-caption -mt-1 flex items-center gap-3 rounded-2xl p-3 text-start'
                  >
                    {location.locating ? (
                      <Loader2 className='text-primary size-5 shrink-0 animate-spin' />
                    ) : (
                      <LocateFixed className='text-primary size-5 shrink-0' />
                    )}
                    <span className='flex flex-col gap-0.5'>
                      <span className='font-semibold'>{t('useMyLocation')}</span>
                      <span className='text-muted-foreground'>{t('deliveryPinWhy')}</span>
                    </span>
                  </button>
                ) : (
                  <p
                    role={pinTried && !pinned ? 'alert' : undefined}
                    className={cn(
                      'text-caption -mt-1 px-1',
                      pinTried && !pinned ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {pinTried && !pinned ? t('deliveryNeedPin') : t('deliveryMovePin')}
                  </p>
                )}
                {/* Outside the form in the page (a layer of its own), so it confirms by its own tap */}
                <button type='button' onClick={confirmPin} className={cn(pillAction, 'text-body h-14')}>
                  <Check className='size-4' strokeWidth={3} />
                  {t('deliveryConfirmPin')}
                </button>
              </div>
            </SheetPrimitive.Content>
          </SheetPrimitive.Portal>
        </SheetPrimitive.Root>
      ) : (
        <>
          {/* Where the pin is, as a small map that stays still; a tap opens the whole map to move it */}
          <button
            type='button'
            onClick={() => setStep('pin')}
            aria-label={t('deliveryAdjustPin')}
            className='relative block h-32 overflow-hidden rounded-[1.25rem] text-start'
          >
            <div className='pointer-events-none absolute inset-0' aria-hidden>
              <MapPicker start={point} onSettle={() => {}} className='h-full' />
            </div>
            <span className='bg-background text-foreground text-caption absolute end-2 bottom-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold shadow-md'>
              <MapPin className='size-3.5' />
              {t('deliveryAdjustPin')}
            </span>
          </button>

          <Input
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder={t('deliveryStreet')}
            aria-label={t('deliveryStreet')}
            aria-invalid={tried && !streetOk}
            aria-describedby={tried && problem ? 'address-problem' : undefined}
            maxLength={300}
            autoComplete='street-address'
          />
          {/* The building, floor and apartment as chips, each added only if wanted, and a note for the rider under them */}
          <DetailChips
            title={t('deliveryDetails')}
            optional={t('optional')}
            details={[
              { key: 'building', label: t('deliveryBuilding'), value: building, onChange: setBuilding, maxLength: 100 },
              {
                key: 'floor',
                label: t('deliveryFloor'),
                value: floor,
                onChange: setFloor,
                numeric: true,
                maxLength: 50,
              },
              {
                key: 'apartment',
                label: t('deliveryApartment'),
                value: apartment,
                onChange: setApartment,
                maxLength: 50,
              },
            ]}
            note={{ label: t('deliveryRiderNote'), value: directions, onChange: setDirections, maxLength: 500 }}
          />
          {isGuest && (
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('deliveryYourName')}
              aria-label={t('deliveryYourName')}
              aria-invalid={tried && !nameOk}
              aria-describedby={tried && problem ? 'address-problem' : undefined}
              maxLength={100}
              autoComplete='name'
            />
          )}
          {phoneField ? (
            <Input
              value={phone}
              onChange={(e) => {
                // Typing keeps the field: a number that turns valid mid-way does not fold it away
                setEditPhone(true)
                setPhone(e.target.value)
              }}
              placeholder={phonePlaceholder || t('deliveryPhone')}
              aria-label={t('deliveryPhone')}
              aria-invalid={tried && !phoneOk}
              aria-describedby={tried && problem ? 'address-problem' : undefined}
              type='tel'
              inputMode='tel'
              autoComplete='tel'
              // The digits read left to right, but the field sits with the others: on the right in Arabic
              dir='ltr'
              className='rtl:text-right'
            />
          ) : (
            phoneOk && (
              <div className='flex min-h-11 items-center gap-3 px-1'>
                <Phone className='text-muted-foreground size-4 shrink-0' />
                <span className='flex min-w-0 flex-1 flex-col'>
                  <span className='text-muted-foreground text-caption'>{t('deliveryPhone')}</span>
                  <bdi dir='ltr' className='text-note font-semibold'>
                    {showPhone(phone)}
                  </bdi>
                </span>
                <button
                  type='button'
                  onClick={() => setEditPhone(true)}
                  className='text-note min-h-11 px-2 font-semibold underline underline-offset-4'
                >
                  {t('deliveryChange')}
                </button>
              </div>
            )
          )}
          {tried && problem && (
            <p id='address-problem' role='alert' className='text-destructive text-caption px-1'>
              {problem}
            </p>
          )}

          {auth.isAuthenticated && (
            <div className='flex flex-wrap items-center gap-2' role='group' aria-label={t('deliveryLabel')}>
              {(['home', 'work'] as const).map((k) => (
                <button
                  key={k}
                  type='button'
                  aria-pressed={kind === k}
                  onClick={() => setKind(kind === k ? 'other' : k)}
                  className={cn(
                    'text-note h-11 rounded-full px-4 font-semibold',
                    kind === k ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  {k === 'home' ? t('deliveryLabelHome') : t('deliveryLabelWork')}
                </button>
              ))}
            </div>
          )}

          <button type='submit' disabled={busy} className={cn(pillAction, 'mt-1')}>
            {busy ? <Loader2 className='size-4 animate-spin' /> : <Check className='size-4' strokeWidth={3} />}
            {t('deliverySaveAddress')}
          </button>
          {initial?.id != null &&
            (removing ? (
              <div className='flex flex-col gap-2' role='group' aria-label={t('deliveryRemoveConfirm')}>
                <p className='text-note text-center font-semibold'>{t('deliveryRemoveConfirm')}</p>
                <div className='grid grid-cols-2 gap-2'>
                  <button
                    type='button'
                    onClick={() => setRemoving(false)}
                    className='bg-muted text-note h-11 rounded-full font-semibold'
                  >
                    {t('deliveryKeep')}
                  </button>
                  <button
                    type='button'
                    onClick={() => void forget()}
                    disabled={remove.isPending}
                    className='bg-destructive text-note h-11 rounded-full font-semibold text-white'
                  >
                    {t('deliveryRemoveYes')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type='button'
                onClick={() => setRemoving(true)}
                className='text-destructive text-note flex h-11 items-center justify-center gap-2 font-semibold'
              >
                <Trash2 className='size-4' />
                {t('deliveryRemoveAddress')}
              </button>
            ))}
        </>
      )}
    </form>
  )
}
