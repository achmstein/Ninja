import { useEffect } from 'react'
import { Banknote, Loader2, Minus, Plus, User } from 'lucide-react'
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
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useRefund } from './use-refund'

type RefundDialogProps = {
  ticket: TicketDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Owner-only: issues a credit note against a settled ticket, from the bill's
 * own page. What is picked, the preview and the rules are `useRefund`'s, the
 * same making the receipts page uses beside its list.
 */
export function RefundDialog({ ticket, open, onOpenChange }: RefundDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const making = useRefund(ticket, () => onOpenChange(false))
  const { lines, remainder, preview, everythingPicked, reason, setReason, tender, setTender, holders, holder, setHolderId, offerAccount, canRefund } = making
  const pickEverything = making.pickEverything
  const submit = making.submit
  const refund = { isPending: making.pending }
  const setQty = (id: number, _left: number, next: number) => {
    const entry = lines.find((e) => e.id === id)
    if (entry) making.step(entry, next > entry.picked ? 1 : -1)
  }

  // Each opening starts clean
  const reset = making.reset
  useEffect(() => {
    if (!open) reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4'>
        <DialogHeader>
          <DialogTitle className='type-title'>
            {t('refundTitle', { number: toNumber(ticket.receiptNumber ?? 0) })}
          </DialogTitle>
          <DialogDescription className='type-body'>
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
                  <div className='text-muted-foreground type-detail tabular-nums'>
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
                  <span className='w-8 text-center type-body font-semibold tabular-nums'>
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
        <div className={cn('grid gap-2', offerAccount && 'grid-cols-2')}>
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
          {offerAccount && (
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
          )}
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
