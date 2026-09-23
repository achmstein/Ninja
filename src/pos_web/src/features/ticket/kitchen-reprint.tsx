import { useMemo, useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Printer } from 'lucide-react'
import {
  getKitchenStationsOptions,
  reprintOrderKitchenTicketsMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'

/** Ordering refuses a reprint with the reason as a bare string. */
const refusal = (error: unknown) =>
  error instanceof AxiosError && typeof error.response?.data === 'string'
    ? error.response.data
    : null

/**
 * The bill's "Kitchen tickets" button: the paper jammed, or a cook lost a
 * ticket. Only where the branch has a station that prints, and only for a
 * bill with orders on it. Opens the bill's orders, newest first, each with
 * a Reprint that sends every station's ticket for it again, marked REPRINT
 * so the kitchen does not make it twice.
 */
export function KitchenReprintButton({ lines }: { lines: TicketLineView[] }) {
  const t = useT()
  const localized = useLocalized()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState<Set<number>>(new Set())

  const stations = useQuery({
    ...getKitchenStationsOptions({ query: { 'api-version': API_VERSION } }),
    staleTime: 60_000,
  })
  const branchPrints = (stations.data ?? []).some((s) => s.printsTickets)

  // One entry per order, newest on top
  const orders = useMemo(() => {
    const byOrder = new Map<number, TicketLineView[]>()
    for (const line of lines) {
      if (line.orderId == null) continue
      const id = toNumber(line.orderId)
      byOrder.set(id, [...(byOrder.get(id) ?? []), line])
    }
    return [...byOrder.entries()].reverse()
  }, [lines])

  const reprint = useMutation({
    ...reprintOrderKitchenTicketsMutation(),
    onSuccess: (_data, variables) => {
      setSent((ids) => new Set(ids).add(Number(variables.path.orderId)))
      toast.success(t('kitchenTicketsSent'))
    },
    onError: (error) => toast.error(refusal(error) ?? t('somethingWentWrong')),
  })

  if (!branchPrints || orders.length === 0) return null

  const sending = reprint.isPending ? Number(reprint.variables?.path.orderId) : null

  return (
    <>
      <Button variant='outline' className='h-12 gap-2 px-3' onClick={() => setOpen(true)}>
        <Printer className='size-5' />
        <span className='hidden sm:inline'>{t('kitchenTickets')}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('kitchenTickets')}</DialogTitle>
            <DialogDescription>{t('kitchenTicketsHint')}</DialogDescription>
          </DialogHeader>
          <ul className='max-h-80 divide-y overflow-y-auto'>
            {orders.map(([orderId, orderLines]) => (
              <li key={orderId} className='flex items-center gap-3 py-2.5'>
                <div className='min-w-0 flex-1'>
                  <p className='font-semibold tabular-nums'>
                    {t('orderNumber', { id: orderId })}
                  </p>
                  <p className='text-muted-foreground truncate text-sm'>
                    {orderLines
                      .map((line) => `${toNumber(line.qty)}× ${localized(line.description)}`)
                      .join(' · ')}
                  </p>
                </div>
                <Button
                  variant={sent.has(orderId) ? 'secondary' : 'outline'}
                  className='h-12 gap-2'
                  disabled={sending === orderId}
                  onClick={() =>
                    reprint.mutate({
                      path: { orderId },
                      query: { 'api-version': API_VERSION },
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
            <Button variant='outline' className='h-12' onClick={() => setOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
