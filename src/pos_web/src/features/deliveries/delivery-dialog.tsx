import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bike, History, Loader2, MapPin } from 'lucide-react'
import {
  getKnownDeliveryAddressesOptions,
  getTillDeliveryQuoteOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import type { KnownAddressView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { SaleCustomer, SaleDelivery } from '@/features/sale/cart'
import { emptyDelivery } from '@/features/sale/cart'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { digitCount, normalizePhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { distanceText } from './delivery-details'

/** Enough digits to be worth asking whether the caller had deliveries before */
const MIN_PHONE_DIGITS = 8

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

/**
 * The branch's answer for a delivery the till takes over the phone: whether
 * it delivers at all, its fee and minimum, and, for a location the caller
 * shared, the pin read from it and how far that is. Pausing the customers'
 * orders does not stop the till.
 */
export function useTillDeliveryQuote(location = '', enabled = true) {
  const pasted = useDebounced(location.trim(), 400)
  return useQuery({
    ...getTillDeliveryQuoteOptions({
      query: { 'api-version': API_VERSION, location: pasted || undefined },
    }),
    enabled,
    staleTime: 60_000,
  })
}

function knownLine(a: KnownAddressView, t: ReturnType<typeof useT>): string {
  const parts = [
    a.building ? `${t('deliveryBuilding')} ${a.building}` : null,
    a.floor ? `${t('deliveryFloor')} ${a.floor}` : null,
    a.apartment ? `${t('deliveryApartment')} ${a.apartment}` : null,
  ].filter(Boolean)
  return parts.length > 0 ? `${a.address} · ${parts.join('، ')}` : a.address
}

type DeliveryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The delivery already on the sale, to change; null to start one */
  initial: SaleDelivery | null
  /** Whoever the sale is for already: their name and number start the form */
  customer: SaleCustomer | null
  /** What the items come to, held against the branch's minimum (a warning only) */
  itemsTotal: number
  onSave: (delivery: SaleDelivery, customerName: string) => void
}

/**
 * Where a sale the till took over the phone goes, in the caller's words: the
 * street, the building, the way to the door and the number to call. A pin
 * only when they shared their location; without one the rider goes by the
 * words. The cashier knows the streets, so being past the radius or under
 * the minimum is said, not refused. A caller who had deliveries before is
 * offered those addresses, by their account or their number.
 */
export function DeliveryDialog({
  open,
  onOpenChange,
  initial,
  customer,
  itemsTotal,
  onSave,
}: DeliveryDialogProps) {
  const t = useT()
  const money = useMoney()
  const brand = useBrand()
  const country = brand?.locale.country ?? 'EG'
  const [form, setForm] = useState<SaleDelivery>(emptyDelivery)
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(initial ?? { ...emptyDelivery, phone: customer?.phone ?? '' })
    setName(customer?.name ?? '')
    setTried(false)
  }, [open, initial, customer])

  const set = (patch: Partial<SaleDelivery>) => setForm((f) => ({ ...f, ...patch }))

  const quote = useTillDeliveryQuote(form.location, open)
  const terms = quote.data
  // The pin follows what is pasted: read from it, or none
  const pinned = form.location.trim()
    ? terms?.latitude != null && terms?.longitude != null
    : false
  const reading = form.location.trim() !== '' && quote.isFetching

  const phoneDigits = digitCount(form.phone)
  const lookupPhone = useDebounced(
    phoneDigits >= MIN_PHONE_DIGITS ? normalizePhone(form.phone, country) : '',
    400,
  )
  const known = useQuery({
    ...getKnownDeliveryAddressesOptions({
      query: {
        'api-version': API_VERSION,
        customerUserId: customer?.id ?? undefined,
        phone: lookupPhone || undefined,
      },
    }),
    enabled: open && (!!customer?.id || lookupPhone !== ''),
  })
  const knownAddresses = known.data ?? []

  const pickKnown = (a: KnownAddressView) =>
    setForm({
      address: a.address,
      building: a.building ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      directions: a.directions ?? '',
      phone: form.phone || a.phone || '',
      // Its pin as coordinates, which reads back as the same pin
      location:
        a.latitude != null && a.longitude != null
          ? `${toNumber(a.latitude)}, ${toNumber(a.longitude)}`
          : '',
      latitude: null,
      longitude: null,
    })

  const nameOk = name.trim() !== ''
  const streetOk = form.address.trim() !== ''
  const phoneOk = phoneDigits >= MIN_PHONE_DIGITS
  const minimum = toNumber(terms?.minimumOrder)
  const fee = toNumber(terms?.fee)

  const save = () => {
    setTried(true)
    if (!nameOk || !streetOk || !phoneOk || reading) return
    onSave(
      {
        ...form,
        address: form.address.trim(),
        phone: normalizePhone(form.phone, country),
        latitude: pinned ? toNumber(terms!.latitude) : null,
        longitude: pinned ? toNumber(terms!.longitude) : null,
      },
      name.trim(),
    )
  }

  const error = (show: boolean, text: string) =>
    tried && show ? <p className='text-destructive text-sm'>{text}</p> : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Bike className='size-5' />
            {t('deliveryFormTitle')}
          </DialogTitle>
        </DialogHeader>

        {terms && !terms.delivers ? (
          <p className='text-muted-foreground py-6 text-center'>{t('deliveryNotHere')}</p>
        ) : (
          <div className='flex flex-col gap-4'>
            {/* An account brings its name; a caller off the street says theirs */}
            {!customer?.id && (
              <div className='flex flex-col gap-1.5'>
                <Label htmlFor='delivery-name'>{t('deliveryCustomerName')}</Label>
                <Input
                  id='delivery-name'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className='h-12 text-base'
                  autoComplete='off'
                />
                {error(!nameOk, t('deliveryNeedsName'))}
              </div>
            )}

            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='delivery-phone'>{t('deliveryPhoneLabel')}</Label>
              <Input
                id='delivery-phone'
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
                className='h-12 text-base'
                inputMode='tel'
                dir='ltr'
                autoComplete='off'
              />
              {error(!phoneOk, t('deliveryPhoneInvalid'))}
            </div>

            {knownAddresses.length > 0 && (
              <div className='flex flex-col gap-1.5'>
                <span className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
                  <History className='size-3.5' />
                  {t('deliveryKnownAddresses')}
                </span>
                <div className='flex flex-col gap-1.5'>
                  {knownAddresses.map((a, i) => (
                    <button
                      key={i}
                      type='button'
                      onClick={() => pickKnown(a)}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-2.5 text-start text-sm',
                        a.address === form.address && (a.building ?? '') === form.building
                          ? 'border-primary bg-primary/5'
                          : 'bg-background',
                      )}
                    >
                      <MapPin className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                      <span className='min-w-0 flex-1'>
                        {a.label && <span className='font-semibold'>{a.label} · </span>}
                        {knownLine(a, t)}
                        {a.directions && (
                          <span className='text-muted-foreground block truncate italic'>"{a.directions}"</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='delivery-street'>{t('deliveryStreetLabel')}</Label>
              <Input
                id='delivery-street'
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                className='h-12 text-base'
                autoComplete='off'
              />
              {error(!streetOk, t('deliveryNeedsStreet'))}
            </div>

            <div className='grid grid-cols-3 gap-2'>
              {(
                [
                  ['building', 'deliveryBuildingLabel'],
                  ['floor', 'deliveryFloorLabel'],
                  ['apartment', 'deliveryApartmentLabel'],
                ] as const
              ).map(([field, label]) => (
                <div key={field} className='flex flex-col gap-1.5'>
                  <Label htmlFor={`delivery-${field}`}>{t(label)}</Label>
                  <Input
                    id={`delivery-${field}`}
                    value={form[field]}
                    onChange={(e) => set({ [field]: e.target.value })}
                    className='h-12 text-base'
                    autoComplete='off'
                  />
                </div>
              ))}
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='delivery-directions'>{t('deliveryDirectionsLabel')}</Label>
              <Input
                id='delivery-directions'
                value={form.directions}
                onChange={(e) => set({ directions: e.target.value })}
                placeholder={t('deliveryDirectionsHint')}
                className='h-12 text-base'
                autoComplete='off'
              />
            </div>

            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='delivery-location'>{t('deliveryLocationLabel')}</Label>
              <Input
                id='delivery-location'
                value={form.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder='https://maps.app.goo.gl/…'
                className='h-12 text-base'
                dir='ltr'
                autoComplete='off'
              />
              <p className='text-muted-foreground text-sm'>
                {reading ? (
                  <span className='flex items-center gap-1.5'>
                    <Loader2 className='size-3.5 animate-spin' />
                    {t('deliveryLocationReading')}
                  </span>
                ) : !form.location.trim() ? (
                  t('deliveryLocationHint')
                ) : pinned ? (
                  <span className='text-foreground flex items-center gap-1.5'>
                    <MapPin className='size-3.5' />
                    {t('deliveryLocationFound', {
                      distance: distanceText(toNumber(terms?.distanceMeters), t),
                    })}
                  </span>
                ) : (
                  t('deliveryLocationUnread')
                )}
              </p>
            </div>

            {/* Said, not refused: the cashier knows the streets and the regulars */}
            {terms && !reading && (
              <div className='flex flex-col gap-1.5'>
                {pinned && !terms.inRange && (
                  <Warning>{t('deliveryOutOfRange', { km: toNumber(terms.radiusKm) })}</Warning>
                )}
                {minimum > 0 && itemsTotal < minimum && (
                  <Warning>{t('deliveryUnderMinimum', { amount: money(minimum) })}</Warning>
                )}
                <div className='text-muted-foreground flex justify-between text-sm'>
                  <span>{t('deliveryFee')}</span>
                  <span className='tabular-nums'>{fee > 0 ? money(fee) : t('deliveryFree')}</span>
                </div>
              </div>
            )}

            <Button size='lg' className='h-14 text-lg' onClick={save} disabled={reading}>
              {t('deliverySave')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className='flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-700 dark:text-amber-400'>
      <AlertTriangle className='size-4 shrink-0' />
      {children}
    </p>
  )
}
