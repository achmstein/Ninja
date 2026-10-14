import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Field } from '@/components/field'
import { customersService } from '@/features/customers/services/customers-service'
import { type Customer } from '@/features/customers/types'
import { staffError } from '../staff-errors'

interface EditStaffDialogProps {
  user: Customer | null
  onOpenChange: (open: boolean) => void
}

/**
 * A staff account's own details (owner-only): the name and phone the till
 * and the riders' list show, and a new password when one is forgotten. Any
 * account, an owner's too; where it may work is the branches dialog's.
 */
export function EditStaffDialog({ user, onOpenChange }: EditStaffDialogProps) {
  const t = useT()
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('editStaffAccount')}</DialogTitle>
          <DialogDescription>{user?.email ?? ''}</DialogDescription>
        </DialogHeader>
        {/* Keyed by the account so the form mounts from what it holds today */}
        {user && (
          <DetailsForm key={user.id} user={user} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DetailsForm({
  user,
  onOpenChange,
}: {
  user: Customer
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [phone, setPhone] = useState(user.phoneNumber ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      await customersService.updateProfile(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim() || null,
      })
      // Left empty, the password stays as it is
      if (password) await customersService.setPassword(user.id, password)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast.success(t('accountUpdated'))
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
    if (password && password.length < 8) {
      setError(t('passwordMinLength'))
      return
    }
    setError('')
    save.mutate()
  }

  return (
    <form onSubmit={submit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-3'>
        <Field label={t('firstName')} htmlFor='staffFirstName'>
          <Input
            id='staffFirstName'
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label={t('lastName')} htmlFor='staffLastName'>
          <Input
            id='staffLastName'
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </Field>
      </div>
      <Field label={t('phone')} htmlFor='staffPhone'>
        <Input
          id='staffPhone'
          type='tel'
          dir='ltr'
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </Field>
      <Field label={t('newPassword')} htmlFor='staffNewPassword'>
        <Input
          id='staffNewPassword'
          type='password'
          autoComplete='new-password'
          placeholder={t('staffPasswordUnchanged')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
