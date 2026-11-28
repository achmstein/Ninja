import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Printer } from 'lucide-react'
import {
  getKitchenStationsOptions,
  reprintOrderKitchenTicketsMutation,
} from '@ninja/api/ordering/@tanstack/react-query.gen'
import type { TicketLineView } from '@ninja/api/sales/types.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
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

/** Ordering refuses a reprint with the reason as a bare string. */
const refusal = (error: unknown) =>
  error instanceof AxiosError && typeof error.response?.data === 'string' ? error.response.data : null

/** One entry per order on the bill, newest on top */
function ordersOn(lines: TicketLineView[]) {
  const byOrder = new Map<number, TicketLineView[]>()
  for (const line of lines) {
    if (line.orderId == null) continue
    const id = toNumber(line.orderId)
    byOrder.set(id, [...(byOrder.get(id) ?? []), line])
  }
  return [...byOrder.entries()].reverse()
}

/**
 * Whether the bill offers "Kitchen tickets": only where the branch has a
 * station that prints, and only for a bill with orders on it.
 */
export function useCanReprintKitchen(lines: TicketLineView[]) {
  const stations = useQuery({
    ...getKitchenStationsOptions(),
    staleTime: 60_000,
  })
  const branchPrints = (stations.data ?? []).some((s) => s.printsTickets)
  return branchPrints && lines.some((line) => line.orderId != null)
}

/**
 * The bill's kitchen tickets, from its ⋯ menu: the paper jammed, or a cook
 * lost a ticket. The bill's orders, newest first, each with a Reprint that
 * sends every station's ticket for it again, marked REPRINT so the kitchen
 * does not make it twice.
 */
export function KitchenReprintDialog({
  lines,
  open,
  onOpenChange,
}: {
  lines: TicketLineView[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const [sent, setSent] = useState<Set<number>>(new Set())
  const orders = useMemo(() => ordersOn(lines), [lines])

  const reprint = useMutation({
    ...reprintOrderKitchenTicketsMutation(),
    onSuccess: (_data, variables) => {
      setSent((ids) => new Set(ids).add(Number(variables.path.orderId)))
      toast.success(t('kitchenTicketsSent'))
    },
    onError: (error) => toast.error(refusal(error) ?? t('somethingWentWrong')),
  })

  const sending = reprint.isPending ? Number(reprint.variables?.path.orderId) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('kitchenTickets')}</DialogTitle>
          <DialogDescription>{t('kitchenTicketsHint')}</DialogDescription>
        </DialogHeader>
        <ul className='max-h-80 divide-y overflow-y-auto'>
          {orders.map(([orderId, orderLines]) => (
            <li key={orderId} className='flex items-center gap-3 py-2.5'>
              <div className='min-w-0 flex-1'>
                <p className='type-heading tabular-nums'>{t('orderNumber', { id: orderId })}</p>
                <p className='text-muted-foreground type-detail truncate'>
                  {orderLines.map((line) => `${toNumber(line.qty)}× ${localized(line.description)}`).join(' · ')}
                </p>
              </div>
              <Button
                variant={sent.has(orderId) ? 'secondary' : 'outline'}
                className='h-12 gap-2'
                disabled={sending === orderId}
                onClick={() =>
                  reprint.mutate({
                    path: { orderId },
                  })
                }
              >
                {sent.has(orderId) ? <Check className='size-5' /> : <Printer className='size-5' />}
                {t('reprint')}
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant='outline' className='h-12' onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
