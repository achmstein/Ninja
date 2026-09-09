import { useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useT } from '@/lib/i18n'
import { OrderCard } from './order-card'
import { useKitchenOrders, useNowMs } from './use-kitchen-orders'
import { useReady } from './use-ready'

/**
 * The day's finished orders, behind the clock icon in the header: newest
 * first, the same card the board showed, for a "was that with oat milk?"
 * look back — and a Bring back for the card bumped too early or the drink
 * that has to be made again. Reads the board's own query, so it costs no
 * extra request.
 */
export function HistoryDialog() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const nowMs = useNowMs()
  const { orders } = useKitchenOrders()
  const { setReady, actingOrderNumber } = useReady()

  const finished = useMemo(
    () =>
      orders
        .filter((order) => order.readyAt != null)
        .sort(
          (a, b) =>
            new Date(b.readyAt!).getTime() - new Date(a.readyAt!).getTime()
        ),
    [orders]
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='ghost' size='icon' className='size-12'>
          <History className='size-5' />
          <span className='sr-only'>{t('history')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className='flex h-[85svh] flex-col gap-0 p-0 sm:max-w-5xl'>
        <DialogHeader className='border-b px-4 py-3'>
          <DialogTitle className='text-xl'>{t('history')}</DialogTitle>
          <DialogDescription className='text-base'>
            {t('historyHint')}
          </DialogDescription>
        </DialogHeader>
        <div className='min-h-0 flex-1 overflow-y-auto p-3'>
          {finished.length === 0 ? (
            <p className='text-muted-foreground p-6 text-center text-lg'>
              {t('noHistory')}
            </p>
          ) : (
            // Columns, as on the board: no holes under short cards
            <div className='columns-[16rem] gap-3'>
              {finished.map((order) => {
                const id = Number(order.orderNumber)
                return (
                  <div key={id} className='mb-3 break-inside-avoid'>
                    <OrderCard
                      order={order}
                      nowMs={nowMs}
                      isActing={actingOrderNumber === id}
                      onBringBack={() => {
                        setReady(id, false)
                        setOpen(false)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
