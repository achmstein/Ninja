import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NumericKeypad } from '@/components/numeric-keypad'
import { apiClient } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { toast } from '@/lib/toast'
import type { CardCustomer } from './customer-card'
import { invalidateCustomer } from './use-customer-card'

type OldBalanceDialogProps = {
  customer: CardCustomer
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * What a customer already owed when the business started keeping its tabs
 * here: the figure from the old notebook, put on their tab as it stands. No
 * money changes hands and nothing is sold, so the drawer and the shift know
 * nothing of it; the customer pays it down like any other debt. The owner's
 * or a manager's to enter (Accounts refuses a cashier).
 */
export function OldBalanceDialog({
  customer,
  open,
  onOpenChange,
}: OldBalanceDialogProps) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()
  const [amountStr, setAmountStr] = useState('')
  // One request id per open: a retry on shaky Wi-Fi must not owe them twice
  const requestId = useRef(crypto.randomUUID())

  useEffect(() => {
    if (open) {
      setAmountStr('')
      requestId.current = crypto.randomUUID()
    }
  }, [open])

  const entered = Number(amountStr || '0')
  const amount = Number.isFinite(entered) ? entered : 0

  const add = useMutation({
    // No generated call for this one yet: the shared client, as the customer search does
    mutationFn: () =>
      apiClient.post(
        `/api/accounts/${encodeURIComponent(customer.id)}/old-balance`,
        {
          amount,
          description: t('oldBalance'),
          customerName: customer.name || null,
        },
        { headers: { 'x-requestid': requestId.current } }
      ),
    onSuccess: () => {
      invalidateCustomer(queryClient, customer.id)
      toast.success(t('oldBalanceAdded', { amount: money(amount) }))
      onOpenChange(false)
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-0 overflow-y-auto p-0 sm:max-w-md'>
        <DialogHeader className='border-b px-5 py-3 pe-14'>
          <DialogTitle className='text-lg'>{t('addOldBalance')}</DialogTitle>
          <p className='text-muted-foreground truncate text-sm'>
            {customer.name || t('guest')}
          </p>
        </DialogHeader>

        <div className='flex flex-col gap-3 p-4'>
          <p className='text-muted-foreground text-sm'>{t('oldBalanceHint')}</p>
          <div
            dir='ltr'
            className='bg-muted flex h-14 items-center justify-end rounded-lg px-4 text-3xl font-bold tabular-nums'
          >
            {amountStr || '0'}
          </div>
          <NumericKeypad value={amountStr} onChange={setAmountStr} />

          <Button
            size='lg'
            className='h-14 justify-between px-5 text-lg'
            disabled={amount <= 0 || add.isPending}
            onClick={() => add.mutate()}
          >
            <span>{t('addOldBalance')}</span>
            <span className='tabular-nums'>{money(amount)}</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
