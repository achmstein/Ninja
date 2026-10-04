import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Check, ChevronRight, Home, Briefcase, Loader2, LocateFixed, MapPin, Plus, Trash2 } from 'lucide-react'
import {
  addMyAddressMutation,
  deleteMyAddressMutation,
  updateMyAddressMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { usePhoneRule } from '@/lib/brand'
import { useSelectedBranch } from '@/lib/branch'
import { addressBody, addressLine, fromSaved, useMyAddresses } from '@/lib/delivery'
import { pointOf, useMyLocation, type LatLng } from '@/lib/geo'
import { useT } from '@/lib/i18n'
import { getMyProfile } from '@/lib/services/identity'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useDeliveryStore, type DeliveryAddress } from '@/stores/delivery-store'
import { useGuestStore } from '@/stores/guest-store'
import { Input } from '@/components/ui/input'
import { pillAction } from '@/components/ui/ninja-sheet'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { MapPicker } from './map-pin'

/** Where the map opens when nothing better is known: the middle of Cairo */
const FALLBACK: LatLng = { lat: 30.0444, lng: 31.2357 }

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
  const auth = useAuth()
  const { address: chosen, setAddress } = useDeliveryStore()
  const { data: saved = [], isLoading } = useMyAddresses()
  // The form, for a new address or one being changed; null shows the list
  const [editing, setEditing] = useState<DeliveryAddress | 'new' | null>(null)

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
            {form === 'new' ? t('deliveryNewAddress') : form ? t('deliveryEditAddress') : manage ? t('myAddresses') : t('deliveryAddressTitle')}
          </SheetTitle>
        </SheetHeader>
        {form ? (
          <AddressForm
            initial={form === 'new' ? null : form}
            onDone={(address) => {
              if (!manage) {
                setAddress(address)
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
                return (
                  <button
                    key={address.id ?? 'device'}
                    type='button'
                    onClick={() => {
                      if (manage) {
                        setEditing(address)
                        return
                      }
                      setAddress(address)
                      onOpenChange(false)
                    }}
                    className={cn('flex min-h-16 items-center gap-3 rounded-[1.25rem] px-4 py-3 text-start', on && 'bg-muted')}
                  >
                    <span className='bg-muted grid size-10 shrink-0 place-items-center rounded-full'>
                      <LabelIcon label={address.label} />
                    </span>
                    <span className='flex min-w-0 flex-1 flex-col'>
                      <span className='truncate text-body font-semibold'>{address.label || address.address}</span>
                      <span className='text-muted-foreground line-clamp-2 text-caption'>
                        {addressLine(address, { building: t('deliveryBuilding'), floor: t('deliveryFloor'), apartment: t('deliveryApartment') })}
                      </span>
                    </span>
                    {on ? <Check className='size-5 shrink-0' /> : manage && <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' />}
                  </button>
                )
              })
            )}
            {manage && empty && <p className='text-muted-foreground px-1 py-4 text-note'>{t('myAddressesEmpty')}</p>}
            <button
              type='button'
              onClick={() => setEditing('new')}
              className='flex min-h-14 items-center gap-3 rounded-[1.25rem] px-4 text-start text-body font-semibold'
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
  return a.id != null ? a.id === b.id : a.latitude === b.latitude && a.longitude === b.longitude && a.address === b.address
}

function LabelIcon({ label }: { label?: string | null }) {
  const t = useT()
  if (label && label === t('deliveryLabelHome')) return <Home className='size-5' />
  if (label && label === t('deliveryLabelWork')) return <Briefcase className='size-5' />
  return <MapPin className='size-5' />
}

/**
 * One address: the map first (move it until the pin is on the door), then
 * the words a rider needs. A signed-in customer's is saved on their account;
 * a guest's stays on the device. Removing one is at the foot of its form.
 */
function AddressForm({ initial, onDone }: { initial: DeliveryAddress | null; onDone: (address: DeliveryAddress) => void }) {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const branch = useSelectedBranch()
  const phoneRule = usePhoneRule((s) => s.pattern)
  const guestPhone = useGuestStore((s) => s.contact?.phone ?? '')
  const location = useMyLocation(initial == null)

  const [point, setPoint] = useState<LatLng>(() =>
    initial ? { lat: initial.latitude, lng: initial.longitude } : (location.here ?? pointOf(branch) ?? FALLBACK)
  )
  // The map flies once to where the customer is, the first time that is known
  const [flyTo, setFlyTo] = useState<LatLng | null>(null)
  const [flew, setFlew] = useState(initial != null)
  if (!flew && location.here) {
    setFlew(true)
    setFlyTo(location.here)
  }

  const [street, setStreet] = useState(initial?.address ?? '')
  const [building, setBuilding] = useState(initial?.building ?? '')
  const [floor, setFloor] = useState(initial?.floor ?? '')
  const [apartment, setApartment] = useState(initial?.apartment ?? '')
  const [directions, setDirections] = useState(initial?.directions ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? guestPhone)
  const [label, setLabel] = useState(initial?.label ?? '')
  const [tried, setTried] = useState(false)

  // A signed-in customer's own number, when the form starts without one
  useEffect(() => {
    if (!auth.isAuthenticated || phone) return
    let cancelled = false
    getMyProfile()
      .then((profile) => {
        if (!cancelled && profile?.phoneNumber) setPhone((current) => current || profile.phoneNumber!.trim())
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, as the form opens
  }, [auth.isAuthenticated])

  const refresh = () => queryClient.invalidateQueries({ queryKey: [{ _id: 'getMyAddresses' }] })
  const add = useMutation({ ...addMyAddressMutation(), onSuccess: refresh })
  const update = useMutation({ ...updateMyAddressMutation(), onSuccess: refresh })
  const remove = useMutation({ ...deleteMyAddressMutation(), onSuccess: refresh })
  const busy = add.isPending || update.isPending

  const phoneOk = phoneRule.test(phone.trim().replace(/[\s-]/g, ''))
  const streetOk = street.trim().length > 0

  const save = async () => {
    setTried(true)
    if (!streetOk || !phoneOk) return
    const address: DeliveryAddress = {
      id: initial?.id,
      label: label.trim() || null,
      latitude: point.lat,
      longitude: point.lng,
      address: street.trim(),
      building: building.trim() || null,
      floor: floor.trim() || null,
      apartment: apartment.trim() || null,
      directions: directions.trim() || null,
      phone: phone.trim(),
    }
    if (!auth.isAuthenticated) {
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
    } catch {
      toast.error(t('deliveryAddressNotSaved'))
    }
  }

  const forget = async () => {
    if (initial?.id == null) return
    try {
      await remove.mutateAsync({ path: { addressId: initial.id }, query: { 'api-version': API_VERSION } })
      const { address, setAddress } = useDeliveryStore.getState()
      if (address?.id === initial.id) setAddress(null)
      toast.success(t('deliveryAddressRemoved'))
      onDone(initial)
    } catch {
      toast.error(t('deliveryAddressNotSaved'))
    }
  }

  return (
    <form
      className='flex flex-col gap-3'
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className='relative'>
        <MapPicker start={point} to={flyTo} onSettle={setPoint} className='h-56' />
        {location.canLocate && (
          <button
            type='button'
            onClick={() => {
              setFlew(false)
              location.locate()
            }}
            className='bg-background text-foreground absolute end-2 bottom-2 grid size-10 place-items-center rounded-full shadow-md'
            aria-label={t('useMyLocation')}
          >
            {location.locating ? <Loader2 className='size-4 animate-spin' /> : <LocateFixed className='size-4' />}
          </button>
        )}
      </div>
      <p className='text-muted-foreground -mt-1 px-1 text-caption'>{t('deliveryMovePin')}</p>

      <Input
        value={street}
        onChange={(e) => setStreet(e.target.value)}
        placeholder={t('deliveryStreet')}
        aria-label={t('deliveryStreet')}
        aria-invalid={tried && !streetOk}
        autoComplete='street-address'
      />
      <div className='grid grid-cols-3 gap-2'>
        <Input value={building} onChange={(e) => setBuilding(e.target.value)} placeholder={t('deliveryBuilding')} aria-label={t('deliveryBuilding')} />
        <Input value={floor} onChange={(e) => setFloor(e.target.value)} placeholder={t('deliveryFloor')} aria-label={t('deliveryFloor')} inputMode='numeric' />
        <Input value={apartment} onChange={(e) => setApartment(e.target.value)} placeholder={t('deliveryApartment')} aria-label={t('deliveryApartment')} />
      </div>
      <Input
        value={directions}
        onChange={(e) => setDirections(e.target.value)}
        placeholder={t('deliveryDirectionsHint')}
        aria-label={t('deliveryDirections')}
      />
      <Input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder={t('deliveryPhone')}
        aria-label={t('deliveryPhone')}
        aria-invalid={tried && !phoneOk}
        type='tel'
        inputMode='tel'
        autoComplete='tel'
        dir='ltr'
      />
      {tried && (!streetOk || !phoneOk) && (
        <p className='text-destructive px-1 text-caption'>{!streetOk ? t('deliveryNeedStreet') : t('deliveryNeedPhone')}</p>
      )}

      {auth.isAuthenticated && (
        <div className='flex flex-wrap items-center gap-2'>
          {[t('deliveryLabelHome'), t('deliveryLabelWork')].map((word) => (
            <button
              key={word}
              type='button'
              onClick={() => setLabel(label === word ? '' : word)}
              className={cn('h-9 rounded-full px-4 text-note font-semibold', label === word ? 'bg-primary text-primary-foreground' : 'bg-muted')}
            >
              {word}
            </button>
          ))}
          <Input
            value={label === t('deliveryLabelHome') || label === t('deliveryLabelWork') ? '' : label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('deliveryLabel')}
            aria-label={t('deliveryLabel')}
            className='h-9 flex-1 rounded-full'
          />
        </div>
      )}

      <button type='submit' disabled={busy} className={cn(pillAction, 'mt-1')}>
        {busy ? <Loader2 className='size-4 animate-spin' /> : <Check className='size-4' strokeWidth={3} />}
        {t('deliverySaveAddress')}
      </button>
      {initial?.id != null && (
        <button
          type='button'
          onClick={() => void forget()}
          disabled={remove.isPending}
          className='text-destructive flex h-11 items-center justify-center gap-2 text-note font-semibold'
        >
          <Trash2 className='size-4' />
          {t('deliveryRemoveAddress')}
        </button>
      )}
    </form>
  )
}
