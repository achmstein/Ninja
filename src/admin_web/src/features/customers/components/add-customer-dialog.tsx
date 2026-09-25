import { useEffect, useState } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { UserCheck, UserRound } from 'lucide-react'
import { useBrand, useFeatures } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { normalizeName, normalizePhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getGuestsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { loyaltyService } from '@/features/loyalty/services/loyalty-service'
import { customersKeys } from '../hooks/use-customers'
import {
  counterCustomersService,
  existingCustomerOf,
} from '../services/counter-customers-service'
import { getCustomerDisplayName, type Customer } from '../types'

const LOOKUP_DEBOUNCE_MS = 300
const MIN_PHONE_DIGITS = 7
const MIN_NAME_LENGTH = 2

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(handle)
  }, [value, delayMs])
  return debounced
}

type AddCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Show a customer's details: the one just added, or one already here */
  onOpenCustomer: (id: string) => void
}

/**
 * A customer by name and phone, as the till adds them. The number is
 * looked up as it is typed, so a customer who is already here is offered
 * before a second account splits their points; names that look alike are
 * suggested but never block (two Ahmeds are two people).
 */
export function AddCustomerDialog({
  open,
  onOpenChange,
  onOpenCustomer,
}: AddCustomerDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const brand = useBrand()
  const country = brand?.locale?.country ?? 'EG'
  const placeholder = brand?.locale?.phonePlaceholder || '01xxxxxxxxx'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [conflict, setConflict] = useState<Customer | null>(null)

  const normalized = normalizePhone(phone, country)
  const digits = normalized.replace(/\D/g, '')
  const lookupPhone = useDebounced(
    digits.length >= MIN_PHONE_DIGITS ? normalized : '',
    LOOKUP_DEBOUNCE_MS
  )
  const lookupName = useDebounced(
    normalizeName(name).length >= MIN_NAME_LENGTH ? name.trim() : '',
    LOOKUP_DEBOUNCE_MS
  )

  const lookup = useQuery({
    queryKey: ['customerLookup', lookupPhone, lookupName],
    queryFn: ({ signal }) =>
      counterCustomersService.lookup(
        {
          phone: lookupPhone || undefined,
          name: lookupName || undefined,
        },
        signal
      ),
    enabled: open && (lookupPhone.length > 0 || lookupName.length > 0),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })

  // A result for what is typed now, not what was typed a moment ago
  const current =
    lookup.data &&
    lookupPhone === (digits.length >= MIN_PHONE_DIGITS ? normalized : '')
      ? lookup.data
      : undefined
  const match = conflict ?? current?.match ?? null
  const similar = (lookup.data?.similar ?? []).filter((c) => c.id !== match?.id)
  // Someone who ordered without an account left this number: not a
  // customer yet, so nothing blocks creating them, but the name they gave
  // is worth knowing (making them a customer keeps their orders as they are)
  const guests = useQuery({
    ...getGuestsOptions({
      query: { 'api-version': API_VERSION, search: lookupPhone, pageSize: 5 },
    }),
    enabled: open && lookupPhone.length > 0 && !!current?.phoneValid,
    staleTime: 10_000,
  })
  const guest = match
    ? undefined
    : guests.data?.items?.find(
        (g) => !!g.phone && normalizePhone(g.phone, country) === lookupPhone
      )
  const phoneInvalid =
    digits.length >= MIN_PHONE_DIGITS &&
    current !== undefined &&
    !current.phoneValid

  const create = useMutation({
    mutationFn: () => counterCustomersService.create(name.trim(), normalized),
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all })
      toast.success(t('customerAdded'))
      onOpenChange(false)
      onOpenCustomer(customer.id)
    },
    onError: (error) => {
      const existing = existingCustomerOf(error)
      if (existing) setConflict(existing)
      else toast.error(t('somethingWentWrong'))
    },
  })

  const openCustomer = (id: string) => {
    onOpenChange(false)
    onOpenCustomer(id)
  }

  const canCreate =
    name.trim().length > 0 &&
    digits.length >= MIN_PHONE_DIGITS &&
    !match &&
    !phoneInvalid

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('addCustomer')}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-4'
          onSubmit={(e) => {
            e.preventDefault()
            if (canCreate) create.mutate()
          }}
        >
          <div className='flex flex-col gap-2'>
            <Label htmlFor='counter-customer-phone'>{t('phoneNumber')}</Label>
            <Input
              id='counter-customer-phone'
              type='tel'
              inputMode='tel'
              dir='ltr'
              autoComplete='off'
              autoFocus
              placeholder={placeholder}
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setConflict(null)
              }}
              aria-invalid={phoneInvalid || undefined}
            />
            {phoneInvalid && (
              <p className='text-destructive text-xs'>
                {t('phoneLike', { placeholder })}
              </p>
            )}
            {guest && (
              <div className='bg-muted/50 flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm'>
                <span className='min-w-0'>
                  <span className='text-muted-foreground block text-xs'>
                    {t('orderedAsGuest')}
                  </span>
                  <span className='block truncate font-medium'>
                    {guest.name || t('guestBadge')}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {t('guestOrderCount', { count: Number(guest.orderCount ?? 0) })}
                  </span>
                </span>
                {guest.name && !name.trim() && (
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setName(guest.name ?? '')}
                  >
                    {t('useGuestName')}
                  </Button>
                )}
              </div>
            )}
            {match && (
              <MatchCard
                customer={match}
                onOpen={() => openCustomer(match.id)}
              />
            )}
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='counter-customer-name'>{t('name')}</Label>
            <Input
              id='counter-customer-name'
              autoComplete='off'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {similar.length > 0 && (
              <div className='flex flex-col gap-1'>
                <p className='text-muted-foreground text-xs'>
                  {t('didYouMean')}
                </p>
                {similar.map((c) => (
                  <button
                    key={c.id}
                    type='button'
                    onClick={() => openCustomer(c.id)}
                    className='hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm'
                  >
                    <UserRound className='text-muted-foreground size-4 shrink-0' />
                    <span className='min-w-0 flex-1 truncate'>
                      {getCustomerDisplayName(c)}
                    </span>
                    {c.phoneNumber && (
                      <span
                        className='text-muted-foreground text-xs tabular-nums'
                        dir='ltr'
                      >
                        {c.phoneNumber}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              variant={match ? 'outline' : 'default'}
              disabled={!canCreate || create.isPending}
            >
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** The customer this number already belongs to, with the way to them. */
function MatchCard({
  customer,
  onOpen,
}: {
  customer: Customer
  onOpen: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const features = useFeatures()
  const loyalty = useQuery({
    queryKey: ['loyaltyAccount', customer.id],
    queryFn: () => loyaltyService.getAccount(customer.id),
    enabled: features.loyalty,
    retry: false,
  })

  return (
    <div className='bg-muted/50 flex items-center gap-3 rounded-lg border p-3'>
      <UserCheck className='text-primary size-5 shrink-0' />
      <div className='min-w-0 flex-1'>
        <p className='text-muted-foreground text-xs'>{t('alreadyACustomer')}</p>
        <p className='truncate text-sm font-medium'>
          {getCustomerDisplayName(customer)}
        </p>
        <p className='text-muted-foreground truncate text-xs' dir='ltr'>
          {[
            customer.phoneNumber,
            loyalty.data
              ? `${loyalty.data.pointsBalance.toLocaleString(locale)} ${t('points')}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <Button type='button' size='sm' onClick={onOpen}>
        {t('openCustomer')}
      </Button>
    </div>
  )
}
