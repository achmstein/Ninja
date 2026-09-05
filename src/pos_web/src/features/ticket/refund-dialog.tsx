import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, Loader2, Minus, Plus, User } from 'lucide-react'
import { refundTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import type { TicketDetail } from '@/api/sales/types.gen'
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
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { ACCOUNT_TENDER, BASE_TENDERS } from './tenders'

type RefundDialogProps = {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

type Holder = { id: string; name: string }

/**
 * Owner-only: issues a credit note against a settled ticket. Lines are
 * picked by quantity — what is left of each after earlier credit notes —
 * and each gives back what the customer paid for it, service and VAT
 * included; the preview mirrors the server's arithmetic, the server's
 * answer is the one printed. Cash comes out of the drawer; a tab that paid
 * can be credited instead. The reason is mandatory: it is the audit trail.
 */
export function RefundDialog({ ticket, open, onOpenChange }: RefundDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const queryClient = useQueryClient()

  const [qtyByLine, setQtyByLine] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [tender, setTender] = useState<'Cash' | 'Account'>('Cash')
  const [holderId, setHolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setQtyByLine({})
      setReason('')
      setTender('Cash')
      setHolderId(null)
    }
  }, [open])

  // What earlier credit notes already took, per line
  const refundedQty = useMemo(() => {
    const map = new Map<number, number>()
    for (const refund of ticket.refunds ?? []) {
      for (const line of refund.lines ?? []) {
        const id = toNumber(line.ticketLineId)
        map.set(id, (map.get(id) ?? 0) + toNumber(line.qty))
      }
    }
    return map
  }, [ticket.refunds])

  // Discount lines cannot come back on their own; everything else can, up
  // to what is left of it
  const lines = (ticket.lines ?? [])
    .filter((line) => toNumber(line.total) > 0)
    .map((line) => {
      const id = toNumber(line.id)
      const left = toNumber(line.qty) - (refundedQty.get(id) ?? 0)
      return { line, id, left: Math.max(0, left), picked: qtyByLine[id] ?? 0 }
    })
    .filter((entry) => entry.left > 0)

  const total = toNumber(ticket.total)
  const subtotal = toNumber(ticket.subtotal)
  const refundedSoFar = toNumber(ticket.refundedTotal)
  const remainder = Math.max(0, total - refundedSoFar)
  const paidPerMenuPound = subtotal > 0 ? total / subtotal : 1

  const everythingPicked =
    lines.length > 0 && lines.every((entry) => entry.picked >= entry.left)
  const preview = everythingPicked
    ? remainder
    : lines.reduce((sum, entry) => {
        if (entry.picked <= 0) return sum
        const menu =
          (toNumber(entry.line.total) * entry.picked) / toNumber(entry.line.qty)
        return sum + Math.round(menu * paidPerMenuPound * 100) / 100
      }, 0)

  // Tabs that paid this ticket are the only ones a refund can go back onto
  const holders: Holder[] = []
  for (const payment of ticket.payments ?? []) {
    if (payment.tender === ACCOUNT_TENDER.name && payment.customerId) {
      const id = String(payment.customerId)
      if (!holders.some((h) => h.id === id))
        holders.push({ id, name: payment.customerName ?? '' })
    }
  }
  const holder = holders.find((h) => h.id === holderId) ?? holders[0]

  const refund = useMutation({
    ...refundTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      toast.success(
        t('ticketRefunded', {
          number: toNumber(result.number),
          amount: money(result.amount),
        })
      )
      onOpenChange(false)
    },
  })

  const setQty = (id: number, left: number, next: number) =>
    setQtyByLine((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(left, next)),
    }))

  const pickEverything = () =>
    setQtyByLine(Object.fromEntries(lines.map((entry) => [entry.id, entry.left])))

  const canRefund =
    preview > 0 &&
    reason.trim().length > 0 &&
    (tender === 'Cash' || holder != null) &&
    !refund.isPending

  const submit = () =>
    refund.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: {
        lines: lines
          .filter((entry) => entry.picked > 0)
          .map((entry) => ({ lineId: entry.id, qty: entry.picked })),
        reason: reason.trim(),
        tender:
          tender === 'Account'
            ? ACCOUNT_TENDER.value
            : BASE_TENDERS[0].value,
        customerId: tender === 'Account' ? holder?.id : null,
        customerName: tender === 'Account' ? holder?.name : null,
      },
    })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {t('refundTitle', { number: toNumber(ticket.receiptNumber ?? 0) })}
          </DialogTitle>
          <DialogDescription className='text-base'>
            {t('refundHint', { amount: money(remainder) })}
          </DialogDescription>
        </DialogHeader>

        {lines.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center'>
            {t('nothingLeftToRefund')}
          </p>
        ) : (
          <div className='flex flex-col gap-2'>
            {lines.map((entry) => (
              <div
                key={entry.id}
                className='flex items-center gap-3 rounded-xl border p-3'
              >
                <div className='min-w-0 flex-1'>
                  <div className='truncate font-medium'>
                    {localized(entry.line.description)}
                  </div>
                  <div className='text-muted-foreground text-sm tabular-nums'>
                    {t('leftToRefund', { count: entry.left })} ·{' '}
                    {money(entry.line.unitPrice)}
                  </div>
                </div>
                <div className='flex items-center gap-1'>
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-11'
                    disabled={entry.picked <= 0}
                    aria-label='-'
                    onClick={() => setQty(entry.id, entry.left, entry.picked - 1)}
                  >
                    <Minus className='size-4' />
                  </Button>
                  <span className='w-8 text-center text-lg font-semibold tabular-nums'>
                    {entry.picked}
                  </span>
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-11'
                    disabled={entry.picked >= entry.left}
                    aria-label='+'
                    onClick={() => setQty(entry.id, entry.left, entry.picked + 1)}
                  >
                    <Plus className='size-4' />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant='ghost'
              className='h-11 self-end'
              disabled={everythingPicked}
              onClick={pickEverything}
            >
              {t('refundEverything')}
            </Button>
          </div>
        )}

        <div className='grid gap-1.5'>
          <Label htmlFor='refund-reason'>{t('reason')}</Label>
          <Input
            id='refund-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className='h-12 text-base'
            autoComplete='off'
          />
        </div>

        {/* Where the money goes back: the drawer, or a tab that paid */}
        <div className='grid grid-cols-2 gap-2'>
          <button
            type='button'
            onClick={() => setTender('Cash')}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium',
              tender === 'Cash'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <Banknote className='size-5' />
            {t('cash')}
          </button>
          <button
            type='button'
            disabled={holders.length === 0}
            onClick={() => setTender('Account')}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg border text-base font-medium disabled:opacity-40',
              tender === 'Account'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <User className='size-5' />
            {t('account')}
          </button>
        </div>
        {tender === 'Account' && holders.length > 1 && (
          <div className='flex flex-wrap gap-2'>
            {holders.map((h) => (
              <button
                key={h.id}
                type='button'
                onClick={() => setHolderId(h.id)}
                className={cn(
                  'h-10 rounded-full border px-4 text-sm font-medium',
                  holder?.id === h.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                {h.name || h.id}
              </button>
            ))}
          </div>
        )}

        <DialogFooter className='gap-2'>
          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button
            variant='destructive'
            size='lg'
            className='h-12 px-6'
            disabled={!canRefund}
            onClick={submit}
          >
            {refund.isPending && <Loader2 className='size-5 animate-spin' />}
            {t('confirmRefund', { amount: money(preview) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
