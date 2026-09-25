import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Award, Loader2, Phone, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useBrand, useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { sameName } from '@/lib/names'
import { normalizePhone } from '@/lib/phone'
import { toast } from '@/lib/toast'
import {
  createCounterCustomer,
  customerName,
  useCustomerLookup,
  type IdentityCustomer,
} from './counter-customers'
import { useLoyalty } from './use-customer-card'

type NewCustomerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** What was typed in the search: digits start the phone, anything else the name. */
  initialText?: string
  /** The customer to use: the one just added, or one the till already had. */
  onPick: (customer: IdentityCustomer) => void
}

/**
 * A customer by name and phone, added at the counter. As the cashier types,
 * the number is normalized the way Identity will store it and looked up:
 * a customer who already has it is offered in place of a second account,
 * and people with a name like this one are suggested without getting in
 * the way (names are not unique; numbers are).
 */
export function NewCustomerDialog({ open, onOpenChange, initialText = '', onPick }: NewCustomerDialogProps) {
  const t = useT()
  const brand = useBrand()
  const country = brand?.locale.country ?? 'EG'
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [conflict, setConflict] = useState<IdentityCustomer | null>(null)

  useEffect(() => {
    if (!open) return
    const typed = initialText.trim()
    const looksLikePhone = /^[+\d٠-٩۰-۹\s()-]+$/.test(typed)
    setName(looksLikePhone ? '' : typed)
    setPhone(looksLikePhone ? typed : '')
    setNameError(null)
    setPhoneError(null)
    setConflict(null)
  }, [open, initialText])

  const lookup = useCustomerLookup(phone, name, open)
  const normalized = normalizePhone(phone, country)
  // The lookup answered for the number now in the field, not a keystroke ago
  const current = lookup.data && lookup.data.phone === normalized ? lookup.data : null
  const match = conflict ?? current?.match ?? null
  const similar = (lookup.data?.similar ?? []).filter((c) => c.id !== match?.id)
  const placeholder =
    (brand?.locale as { phonePlaceholder?: string } | undefined)?.phonePlaceholder || '01xxxxxxxxx'

  const create = useMutation({
    mutationFn: () => createCounterCustomer(name.trim(), phone),
    onSuccess: (customer) => {
      toast.success(t('customerAdded'))
      onPick(customer)
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const data = error.response?.data as
          | { field?: string; placeholder?: string; existing?: IdentityCustomer }
          | undefined
        if (error.response?.status === 409 && data?.existing) {
          setConflict(data.existing)
          return
        }
        if (error.response?.status === 400) {
          if (data?.field === 'name') setNameError(t('nameRequired'))
          else setPhoneError(t('phoneLike', { placeholder: data?.placeholder ?? placeholder }))
          return
        }
      }
      toast.error(t('somethingWentWrong'))
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (match) return
    if (!name.trim()) {
      setNameError(t('nameRequired'))
      return
    }
    if (current && !current.phoneValid) {
      setPhoneError(t('phoneLike', { placeholder }))
      return
    }
    create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90svh] flex-col gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('newCustomer')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <Label htmlFor='new-customer-phone'>{t('newCustomerPhone')}</Label>
            <Input
              id='new-customer-phone'
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setPhoneError(null)
                setConflict(null)
              }}
              placeholder={placeholder}
              inputMode='tel'
              dir='ltr'
              autoComplete='off'
              className='h-12 text-base'
              autoFocus={!(phone && !name)}
              aria-invalid={!!phoneError}
            />
            {phoneError && <p className='text-destructive text-sm'>{phoneError}</p>}
            {/* Right under the number: the customer it already belongs to */}
            {match && <ExistingCustomer customer={match} onUse={() => onPick(match)} />}
          </div>

          <div className='flex flex-col gap-2'>
            <Label htmlFor='new-customer-name'>{t('newCustomerName')}</Label>
            <Input
              id='new-customer-name'
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameError(null)
              }}
              autoComplete='off'
              className='h-12 text-base'
              autoFocus={phone.length > 0 && name.length === 0}
              aria-invalid={!!nameError}
            />
            {nameError && <p className='text-destructive text-sm'>{nameError}</p>}
            {similar.length > 0 && (
              <div className='flex flex-col gap-1'>
                <p className='text-muted-foreground text-sm'>{t('didYouMean')}</p>
                {similar.map((customer) => (
                  <button
                    key={customer.id}
                    type='button'
                    onClick={() => onPick(customer)}
                    className='hover:bg-accent flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-start'
                  >
                    <User className='text-muted-foreground size-4 shrink-0' />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>{customerName(customer)}</span>
                      {customer.phoneNumber && (
                        <span className='text-muted-foreground block truncate text-sm' dir='ltr'>
                          {customer.phoneNumber}
                        </span>
                      )}
                    </span>
                    {sameName(customerName(customer), name) && (
                      <Badge variant='secondary'>{t('sameName')}</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='grid grid-cols-2 gap-2'>
            <Button type='button' variant='outline' size='lg' className='h-12' onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button
              type='submit'
              size='lg'
              variant={match ? 'outline' : 'default'}
              className='h-12 gap-2'
              disabled={!!match || create.isPending}
            >
              {create.isPending && <Loader2 className='size-4 animate-spin' />}
              {t('createCustomer')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** "Already a customer": who has this number, their points, and the one tap to use them. */
function ExistingCustomer({ customer, onUse }: { customer: IdentityCustomer; onUse: () => void }) {
  const t = useT()
  const features = useFeatures()
  const loyalty = useLoyalty(customer.id, features.loyalty)
  const points = toNumber(loyalty.account?.pointsBalance)

  return (
    <div className='border-primary/40 bg-primary/5 flex flex-col gap-3 rounded-xl border p-3'>
      <div className='flex items-start gap-3'>
        <User className='text-primary mt-0.5 size-5 shrink-0' />
        <div className='min-w-0 flex-1'>
          <p className='text-muted-foreground text-xs font-medium'>{t('alreadyACustomer')}</p>
          <p className='truncate font-semibold'>{customerName(customer)}</p>
          <p className='text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm'>
            {customer.phoneNumber && (
              <span className='flex items-center gap-1' dir='ltr'>
                <Phone className='size-3.5' />
                {customer.phoneNumber}
              </span>
            )}
            {features.loyalty && loyalty.account && (
              <span className='flex items-center gap-1 tabular-nums'>
                <Award className='size-3.5' />
                {t('pointsBalance', { points })}
              </span>
            )}
          </p>
        </div>
        {customer.addedAtCounter && <Badge variant='secondary'>{t('addedAtCounter')}</Badge>}
      </div>
      <Button type='button' className='h-11' onClick={onUse}>
        {t('useThisCustomer')}
      </Button>
    </div>
  )
}
