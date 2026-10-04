import { useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bike, History, Loader2, MapPin } from 'lucide-react'
import { getKnownDeliveryAddressesOptions } from '@/api/ordering/@tanstack/react-query.gen'
import type { KnownAddressView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { emptyDelivery, type SaleCustomer, type SaleDelivery } from '@/features/sale/cart'
import { DELIVERY_LIMITS, MIN_PHONE_DIGITS, validatePhoneDelivery } from '@/features/sale/sale-delivery'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { digitCount, normalizePhone } from '@/lib/phone'
import { isModuleOff } from '@/lib/problem'
import { useDebounced } from '@/lib/use-debounced'
import { cn } from '@/lib/utils'
import { useAddressLine, useDistanceText } from './delivery-details'
import { useTillDeliveryQuote } from './use-deliveries'

type PhoneDeliveryFormProps = {
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
 * words. The cashier knows the streets, so being past the radius or under the
 * minimum is said, not refused. A caller who had deliveries before is offered
 * those addresses, by their account or their number.
 */
export function PhoneDeliveryForm({ open, onOpenChange, ...rest }: PhoneDeliveryFormProps) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg'>
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

function PhoneDeliveryBody({ initial, customer, itemsTotal, onSave }: Omit<PhoneDeliveryFormProps, 'open' | 'onOpenChange'>) {
  const t = useT()
  const money = useMoney()
  const line = useAddressLine()
  const distance = useDistanceText()
  const country = useBrand()?.locale.country ?? 'EG'
  const ids = useId()
  const [form, setForm] = useState<SaleDelivery>(() => initial ?? { ...emptyDelivery, phone: customer?.phone ?? '' })
  const [name, setName] = useState(customer?.name ?? '')
  const [tried, setTried] = useState(false)
  const set = (patch: Partial<SaleDelivery>) => setForm((f) => ({ ...f, ...patch }))

  const quote = useTillDeliveryQuote(form.location)
  const terms = quote.data
  const pasted = form.location.trim()
  // The pin is the one read from the text now in the field, never an earlier link's
  const pinned = pasted !== '' && quote.settled && quote.answeredFor === pasted && terms?.latitude != null && terms.longitude != null
  const reading = pasted !== '' && !quote.settled

  const lookupPhone = useDebounced(digitCount(form.phone) >= MIN_PHONE_DIGITS ? normalizePhone(form.phone, country) : '', 400)
  const known = useQuery({
    ...getKnownDeliveryAddressesOptions({
      query: { 'api-version': API_VERSION, customerUserId: customer?.id ?? undefined, phone: lookupPhone || undefined },
    }),
    enabled: !!customer?.id || lookupPhone !== '',
  })

  const pickKnown = (a: KnownAddressView) =>
    setForm({
      address: a.address,
      building: a.building ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      directions: a.directions ?? '',
      phone: form.phone || a.phone || '',
      // Its pin as coordinates, which reads back as the same pin
      location: a.latitude != null && a.longitude != null ? `${toNumber(a.latitude)}, ${toNumber(a.longitude)}` : '',
      latitude: null,
      longitude: null,
    })

  const errors = validatePhoneDelivery(form, name, !customer?.id)
  const minimum = toNumber(terms?.minimumOrder)
  const fee = toNumber(terms?.fee)

  const save = () => {
    setTried(true)
    if (Object.keys(errors).length > 0 || reading) return
    onSave(
      {
        ...form,
        address: form.address.trim(),
        phone: normalizePhone(form.phone, country),
        latitude: pinned ? toNumber(terms?.latitude) : null,
        longitude: pinned ? toNumber(terms?.longitude) : null,
      },
      name.trim(),
    )
  }

  if (terms && !terms.delivers) return <p className='text-muted-foreground py-6 text-center'>{t('deliveryNotHere')}</p>
  if (quote.isError && isModuleOff(quote.error))
    return <p className='text-muted-foreground py-6 text-center'>{t('problemModuleOff')}</p>

  return (
    <div className='flex flex-col gap-4'>
      {!customer?.id && (
        <Field id={`${ids}-name`} label={t('deliveryCustomerName')} error={tried && errors.name ? t('deliveryNeedsName') : null}>
          {(a) => <Input {...a} value={name} onChange={(e) => setName(e.target.value)} className='h-12 text-base' autoComplete='off' />}
        </Field>
      )}

      <Field id={`${ids}-phone`} label={t('deliveryPhoneLabel')} error={tried && errors.phone ? t('deliveryPhoneInvalid') : null}>
        {(a) => (
          <Input
            {...a}
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className='h-12 text-base'
            inputMode='tel'
            dir='ltr'
            autoComplete='off'
          />
        )}
      </Field>

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
                {a.directions && <span className='text-muted-foreground block truncate italic'>"{a.directions}"</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      <Field id={`${ids}-street`} label={t('deliveryStreetLabel')} error={tried && errors.address ? t('deliveryNeedsStreet') : null}>
        {(a) => (
          <Input
            {...a}
            value={form.address}
            onChange={(e) => set({ address: e.target.value })}
            maxLength={DELIVERY_LIMITS.address}
            className='h-12 text-base'
            autoComplete='off'
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

      <Field id={`${ids}-directions`} label={t('deliveryDirectionsLabel')} error={tried && errors.tooLong ? t('problemTooLong') : null}>
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

      <div className='flex flex-col gap-1.5'>
        <Label htmlFor={`${ids}-location`}>{t('deliveryLocationLabel')}</Label>
        <Input
          id={`${ids}-location`}
          aria-describedby={`${ids}-location-state`}
          value={form.location}
          onChange={(e) => set({ location: e.target.value })}
          placeholder='https://maps.app.goo.gl/…'
          className='h-12 text-base'
          dir='ltr'
          autoComplete='off'
        />
        <div id={`${ids}-location-state`} className='text-muted-foreground text-sm' aria-live='polite'>
          {reading ? (
            <span className='flex items-center gap-1.5'>
              <Loader2 className='size-3.5 animate-spin' aria-hidden />
              {t('deliveryLocationReading')}
            </span>
          ) : quote.isError ? (
            <span className='flex items-center gap-2 text-amber-700 dark:text-amber-400'>
              {t('deliveryQuoteFailed')}
              <Button variant='outline' size='sm' className='h-8' onClick={() => quote.refetch()}>
                {t('retry')}
              </Button>
            </span>
          ) : !pasted ? (
            t('deliveryLocationHint')
          ) : pinned ? (
            <span className='text-foreground flex items-center gap-1.5'>
              <MapPin className='size-3.5' aria-hidden />
              {t('deliveryLocationFound', { distance: distance(toNumber(terms?.distanceMeters)) })}
            </span>
          ) : (
            t('deliveryLocationUnread')
          )}
        </div>
      </div>

      {/* Said, not refused: the cashier knows the streets and the regulars */}
      {terms && !reading && (
        <div className='flex flex-col gap-1.5'>
          {pinned && !terms.inRange && <Warning>{t('deliveryOutOfRange', { km: toNumber(terms.radiusKm) })}</Warning>}
          {minimum > 0 && itemsTotal < minimum && <Warning>{t('deliveryUnderMinimum', { amount: money(minimum) })}</Warning>}
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
        <p id={`${id}-error`} className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </div>
  )
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className='flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-sm text-amber-700 dark:text-amber-400'>
      <AlertTriangle className='size-4 shrink-0' aria-hidden />
      {children}
    </p>
  )
}
