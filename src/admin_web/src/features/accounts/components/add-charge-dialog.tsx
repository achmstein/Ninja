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
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { accountsService } from '../services/accounts-service'
import type { KeycloakUser } from '../types'

interface AddChargeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: KeycloakUser | null
}

export function AddChargeDialog({
  open,
  onOpenChange,
  customer,
}: AddChargeDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const addChargeMutation = useMutation({
    mutationFn: async () => {
      if (!customer) return
      const customerName =
        [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
        customer.username
      await accountsService.addCharge(customer.id, {
        amount: parseFloat(amount),
        description: description || undefined,
        customerName,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(t('chargeAddedSuccess'))
      handleClose()
    },
    onError: () => {
      toast.error(t('failedToAddCharge'))
    },
  })

  const handleClose = () => {
    setAmount('')
    setDescription('')
    onOpenChange(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      toast.error(t('pleaseEnterValidAmount'))
      return
    }
    addChargeMutation.mutate()
  }

  const customerName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ') ||
      customer.username
    : ''

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('addCharge')}</DialogTitle>
          <DialogDescription>
            {t('addChargeDescription', { name: customerName })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='amount'>{t('amountEgpLabel')}</Label>
              <Input
                id='amount'
                type='number'
                step='0.01'
                min='0.01'
                placeholder='0.00'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className='space-y-2'>
              <Label htmlFor='description'>{t('descriptionOptional')}</Label>
              <Textarea
                id='description'
                placeholder={t('chargeDescriptionHint')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={addChargeMutation.isPending}>
              {addChargeMutation.isPending && <Spinner className='me-2' />}
              {t('addCharge')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
