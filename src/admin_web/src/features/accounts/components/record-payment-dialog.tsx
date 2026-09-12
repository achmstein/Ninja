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
import { formatEgp } from '@/features/orders/status'
import { accountsService } from '../services/accounts-service'
import type { AccountSummary } from '../types'

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountSummary | null
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  account,
}: RecordPaymentDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!account) return
      await accountsService.recordPayment(account.customerId, {
        amount: parseFloat(amount),
        description: description || undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      toast.success(t('paymentRecorded'))
      handleClose()
    },
    onError: () => {
      toast.error(t('failedToRecordPayment'))
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
    recordPaymentMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('recordPayment')}</DialogTitle>
          <DialogDescription>
            {t('recordPaymentDescription', {
              name: account?.customerName || t('customer'),
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className='space-y-4 py-4'>
            {account && (
              <div className='bg-muted rounded-lg p-3'>
                <p className='text-muted-foreground text-sm'>
                  {t('currentBalance')}
                </p>
                <p
                  className={`text-2xl font-bold ${account.balance > 0 ? 'text-red-500' : 'text-green-500'}`}
                >
                  {formatEgp(account.balance)}
                </p>
              </div>
            )}

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
                placeholder={t('cashPaymentHint')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={handleClose}>
              {t('cancel')}
            </Button>
            <Button type='submit' disabled={recordPaymentMutation.isPending}>
              {recordPaymentMutation.isPending && <Spinner className='me-2' />}
              {t('recordPayment')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
