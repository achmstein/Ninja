import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { editablePhone } from '@/lib/phone'
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
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/field'
import { staffError } from '@/features/staff/staff-errors'
import { customersKeys } from '../hooks/use-customers'
import { customersService } from '../services/customers-service'
import { type Customer } from '../types'

/**
 * A customer's name and phone, put right by the business: a name typed in
 * a hurry at the till, a nickname, a number that changed. The till, the
 * bills and the loyalty card hear of the new name.
 */
export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('editCustomerDetails')}</DialogTitle>
        </DialogHeader>
        {/* Mounted on open, so it starts from what the account holds now */}
        {open && (
          <DetailsForm customer={customer} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailsForm({
  customer,
  onOpenChange,
}: {
  customer: Customer
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState(customer.firstName ?? '')
  const [lastName, setLastName] = useState(customer.lastName ?? '')
  const [phone, setPhone] = useState(() => editablePhone(customer.phoneNumber))
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () =>
      customersService.updateProfile(customer.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customersKeys.all })
      // The tabs and the points list carry the name too
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(t('customerDetailsSaved'))
      onOpenChange(false)
    },
    onError: (e) => {
      const why = staffError(e)
      toast.error(
        why === null
          ? t('failedToUpdateAccount')
          : 'key' in why
            ? t(why.key)
            : `${t('failedToUpdateAccount')}: ${why.text}`
      )
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) {
      setError(t('nameRequired'))
      return
    }
    setError('')
    save.mutate()
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-3'>
        <Field label={t('firstName')} htmlFor='customerFirstName'>
          <Input
            id='customerFirstName'
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={t('lastName')} htmlFor='customerLastName'>
          <Input
            id='customerLastName'
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t('phone')} htmlFor='customerPhone'>
        <Input
          id='customerPhone'
          type='tel'
          dir='ltr'
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      {error && <p className='text-destructive text-sm'>{error}</p>}
      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </DialogFooter>
    </form>
  )
}
