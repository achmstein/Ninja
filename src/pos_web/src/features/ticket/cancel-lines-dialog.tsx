import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { Minus, Plus } from 'lucide-react'
import { getOrderOptions } from '@ninja/api/ordering/@tanstack/react-query.gen'
import { cancelTicketLinesMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
import type { TicketLineView } from '@ninja/api/sales/types.gen'
import { useFeatures } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { defaultDispositionFor, orderIdsOn, type StockDisposition } from '@/lib/stock-disposition'
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
import { StockDispositionChoice } from '@/components/stock-disposition-choice'
import { isCancellable } from './cancel-lines'

export { isCancellable }

/** The usual reasons, a tap each; any other is typed */
const REASONS = ['cancelReasonChangedMind', 'cancelReasonMistake', 'cancelReasonRanOut', 'cancelReasonTooLong'] as const

/**
 * Owner-only: cancels items of an open bill the kitchen already has, without
 * voiding the bill. A line of more than one asks how many; why is mandatory,
 * as for a void, the usual reasons a tap; and what became of the food, as a
 * void asks. The lines stay on the bill struck, the kitchen strikes them too.
 */
export function CancelLinesDialog({
  ticketId,
  place,
  lines,
  open,
  onOpenChange,
  onDone,
}: {
  ticketId: number
  /** What the bill is called, for the question */
  place: string
  /** The lines picked; only cancellable ones are offered */
  lines: TicketLineView[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const queryClient = useQueryClient()
  const inventory = useFeatures().inventory
  const chosen = lines.filter(isCancellable)
  // How many of each line go; a line not touched goes whole
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  // What the cashier picked; until they pick, the orders' own state decides
  const [picked, setPicked] = useState<StockDisposition | null>(null)

  useEffect(() => {
    if (open) {
      setCounts({})
      setReason('')
      setPicked(null)
    }
  }, [open])

  const orderIds = orderIdsOn(chosen)
  const orders = useQueries({
    queries: orderIds.map((orderId) => ({
      ...getOrderOptions({ path: { orderId } }),
      enabled: open,
    })),
  })
  const disposition = picked ?? defaultDispositionFor(orders.map((o) => o.data?.wasPrepared))
  const hasFood = orderIds.length > 0

  const left = (line: TicketLineView) => toNumber(line.qty)
  const count = (line: TicketLineView) => Math.min(counts[toNumber(line.id)] ?? left(line), left(line))
  const lineBack = (line: TicketLineView) => (toNumber(line.total) * count(line)) / left(line)
  const back = chosen.reduce((sum, line) => sum + lineBack(line), 0)
  const items = chosen.reduce((sum, line) => sum + count(line), 0)

  const cancel = useMutation({
    ...cancelTicketLinesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      toast.success(t('itemsCancelled', { count: items }))
      onOpenChange(false)
      onDone()
    },
    onError: handleServerError,
  })

  const canConfirm = chosen.length > 0 && reason.trim().length > 0 && !cancel.isPending

  const confirm = () =>
    cancel.mutate({
      // A retry on business Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: ticketId },
      body: {
        lines: chosen.map((line) => ({ lineId: toNumber(line.id), qty: count(line) })),
        reason: reason.trim(),
        // Only orders took stock, and only a business with inventory keeps it
        stockDisposition: hasFood && inventory ? disposition : null,
      },
    })

  const setCount = (line: TicketLineView, value: number) => setCounts((now) => ({ ...now, [toNumber(line.id)]: value }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size='lg' className='gap-4'>
        <DialogHeader>
          <DialogTitle className='type-title'>{t('cancelItemsCount', { count: items })}</DialogTitle>
          <DialogDescription className='type-body'>{t('cancelItemsFrom', { place })}</DialogDescription>
        </DialogHeader>

        {/* What goes: a line of more than one says how many of it */}
        <ul className='divide-y rounded-lg border'>
          {chosen.map((line) => (
            <li key={String(line.id)} className='flex min-h-14 items-center gap-3 px-3 py-2'>
              <span className='min-w-0 flex-1'>
                <span className='type-body block truncate font-medium'>{localized(line.description)}</span>
                {localized(line.details) && (
                  <span className='text-muted-foreground type-detail block truncate'>{localized(line.details)}</span>
                )}
              </span>
              {left(line) > 1 ? (
                <span className='flex shrink-0 items-center gap-1'>
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-11 rounded-full'
                    disabled={count(line) <= 1}
                    aria-label={t('decrease')}
                    onClick={() => setCount(line, count(line) - 1)}
                  >
                    <Minus className='size-4' />
                  </Button>
                  <span className='type-body w-16 text-center font-semibold tabular-nums'>
                    {t('countOf', { count: count(line), total: left(line) })}
                  </span>
                  <Button
                    variant='outline'
                    size='icon'
                    className='size-11 rounded-full'
                    disabled={count(line) >= left(line)}
                    aria-label={t('increase')}
                    onClick={() => setCount(line, count(line) + 1)}
                  >
                    <Plus className='size-4' />
                  </Button>
                </span>
              ) : (
                <span className='text-muted-foreground type-body shrink-0 tabular-nums'>1×</span>
              )}
              <span className='type-body w-20 shrink-0 text-end font-medium tabular-nums'>{money(lineBack(line))}</span>
            </li>
          ))}
        </ul>

        {/* Why: mandatory, it is the audit trail. The usual ones are a tap; any other is typed */}
        <div>
          <div className='text-muted-foreground type-label pb-1'>{t('reason')}</div>
          <div className='flex flex-wrap gap-2'>
            {REASONS.map((key) => {
              const why = t(key)
              return (
                <Button
                  key={key}
                  variant={reason === why ? 'default' : 'outline'}
                  className='h-11'
                  onClick={() => setReason(why)}
                >
                  {why}
                </Button>
              )
            })}
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('cancelReasonOther')}
            maxLength={200}
            className='mt-2 h-12 text-base'
            autoComplete='off'
          />
        </div>

        {/* What becomes of the food, as voiding a bill asks */}
        {hasFood && (
          <StockDispositionChoice
            value={disposition}
            onChange={setPicked}
            disabled={cancel.isPending}
            name='cancel-stock-disposition'
          />
        )}

        <DialogFooter className='gap-2'>
          <Button variant='outline' size='lg' className='h-14 min-w-32 text-base' onClick={() => onOpenChange(false)}>
            {t('goBack')}
          </Button>
          <Button
            variant='destructive'
            size='lg'
            className='h-14 min-w-64 justify-between gap-4 px-6 text-lg font-semibold'
            disabled={!canConfirm}
            onClick={confirm}
          >
            <span>{t('cancelItemsCount', { count: items })}</span>
            <span className='tabular-nums'>−{money(back)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
