import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketDetail } from '@/api/sales'
import {
  applyTicketDiscountMutation,
  removeTicketDiscountMutation,
} from '@/api/sales/@tanstack/react-query.gen'
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
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

type DiscountDialogProps = {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Kind = 'percent' | 'amount'

/**
 * Money off the whole bill: a percent or an amount, with a reason. The
 * server holds a cashier to the branch's cap and lets an owner past it;
 * its refusal is the only message the till shows. Given again it replaces
 * the earlier discount; Remove takes it off.
 */
export function DiscountDialog({ ticket, open, onOpenChange }: DiscountDialogProps) {
  const t = useT()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<Kind>('percent')
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')

  const current = toNumber(ticket.discount)
  const hasDiscount = ticket.discountRate != null || current > 0

  // Reopening shows what is on the bill now, so a change starts from it
  useEffect(() => {
    if (!open) return
    if (ticket.discountRate != null) {
      setKind('percent')
      setValue(String(Math.round(toNumber(ticket.discountRate) * 10000) / 100))
    } else {
      setKind(current > 0 ? 'amount' : 'percent')
      setValue(current > 0 ? String(current) : '')
    }
    setReason(ticket.discountReason ?? '')
  }, [open, ticket.discountRate, ticket.discountReason, current])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
    onOpenChange(false)
  }

  const apply = useMutation({
    ...applyTicketDiscountMutation(),
    onSuccess: refresh,
  })

  const remove = useMutation({
    ...removeTicketDiscountMutation(),
    onSuccess: refresh,
  })

  const number = Number(value)
  const pending = apply.isPending || remove.isPending
  const canApply =
    Number.isFinite(number) && number > 0 && reason.trim().length > 0 && !pending

  const doApply = () =>
    apply.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: {
        reason: reason.trim(),
        rate: kind === 'percent' ? number / 100 : null,
        amount: kind === 'amount' ? number : null,
      },
    })

  const doRemove = () =>
    remove.mutate({
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='gap-4 sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('discount')}</DialogTitle>
        </DialogHeader>

        <div className='flex gap-2'>
          <Input
            type='number'
            inputMode='decimal'
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className='h-12 text-lg tabular-nums'
            autoFocus
          />
          <div className='flex rounded-md border'>
            {(['percent', 'amount'] as const).map((k) => (
              <Button
                key={k}
                type='button'
                variant={kind === k ? 'default' : 'ghost'}
                className='h-12 rounded-none px-4 text-base first:rounded-s-md last:rounded-e-md'
                onClick={() => setKind(k)}
              >
                {k === 'percent' ? '%' : t('currency')}
              </Button>
            ))}
          </div>
        </div>

        <div className='grid gap-1.5'>
          <Label htmlFor='discount-reason'>{t('reason')}</Label>
          <Input
            id='discount-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canApply) doApply()
            }}
          />
        </div>

        <DialogFooter className='gap-2 sm:justify-between'>
          {hasDiscount ? (
            <Button
              variant='ghost'
              size='lg'
              className='text-destructive hover:text-destructive h-12'
              disabled={pending}
              onClick={doRemove}
            >
              {t('remove')}
            </Button>
          ) : (
            <span />
          )}
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='lg'
              className='h-12'
              onClick={() => onOpenChange(false)}
            >
              {t('cancel')}
            </Button>
            <Button size='lg' className='h-12' disabled={!canApply} onClick={doApply}>
              {t('apply')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
