import { useState } from 'react'
import { AlertTriangle, Banknote, Bike, CircleDot, Clock, MapPin, Undo2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/features/orders/status'
import { useNowMs } from '@/features/orders/use-pending-orders'
import { useAddressLine } from './delivery-details'
import { boardOrder, laneOf } from './delivery-format'
import { DeliveryOrderDialog } from './delivery-order-dialog'
import { useDeliveries, type BoardDelivery } from './use-deliveries'

/**
 * The branch's deliveries on the floor, by where each one stands: waiting for
 * a rider, couldn't be delivered, with a rider, delivered with the cash still
 * out, back at the branch. A tap gives one to a rider, moves it along or takes
 * the cash in. Gone when there is nothing out, so the floor keeps its room on
 * a quiet day.
 */
export function DeliveriesStrip() {
  const t = useT()
  const { deliveries } = useDeliveries()
  const [open, setOpen] = useState<number | null>(null)
  const live = boardOrder(deliveries.filter((d) => laneOf(d) !== 'done'))
  if (live.length === 0) return null

  // The dialog follows the board, so a move made elsewhere shows in it at once
  const selected = deliveries.find((d) => toNumber(d.orderNumber) === open) ?? null

  return (
    <section className='flex flex-col gap-2' aria-labelledby='deliveries-heading'>
      <div className='flex items-center gap-2'>
        <Bike className='text-primary size-5' aria-hidden />
        <h2 id='deliveries-heading' className='text-lg font-semibold'>
          {t('deliveries')}
        </h2>
        <Badge className='h-6 tabular-nums'>{live.length}</Badge>
      </div>
      <div className='flex gap-3 overflow-x-auto pb-1'>
        {live.map((order) => (
          <DeliveryCard key={toNumber(order.orderNumber)} order={order} onOpen={() => setOpen(toNumber(order.orderNumber))} />
        ))}
      </div>
      <DeliveryOrderDialog order={selected} onOpenChange={(o) => !o && setOpen(null)} />
    </section>
  )
}

function DeliveryCard({ order, onOpen }: { order: BoardDelivery; onOpen: () => void }) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const nowMs = useNowMs()
  const line = useAddressLine()
  const lane = laneOf(order)

  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'bg-card text-card-foreground flex w-[300px] shrink-0 flex-col gap-1 rounded-xl border p-3 text-start shadow-xs',
        (lane === 'waiting' || lane === 'failed') && 'border-amber-500/70',
        lane === 'cashDue' && 'border-emerald-500/70',
      )}
    >
      {/* Who and what to collect; where; then how it stands and since when.
          Each line holds one thing, so no language's longer words push
          another out of the card */}
      <div className='flex items-baseline gap-2'>
        <span className='truncate text-base font-semibold'>{order.customerName || t('guest')}</span>
        <span className='text-muted-foreground shrink-0 text-sm tabular-nums'>#{toNumber(order.orderNumber)}</span>
        <span className='ms-auto shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums'>{money(order.total)}</span>
      </div>
      <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
        <MapPin className='size-3.5 shrink-0' aria-hidden />
        <span className='truncate'>{line(order.delivery)}</span>
      </div>
      <div className='flex items-start gap-2 text-sm'>
        <StageChip order={order} />
        <span className='text-muted-foreground ms-auto shrink-0 whitespace-nowrap'>
          {relativeTime(order.confirmedAt ?? order.date, nowMs, t, locale)}
        </span>
      </div>
    </button>
  )
}

/**
 * Where the delivery has got to, beside the time: in words and an icon, never
 * colour alone; a long rider name wraps under it rather than being cut from
 * the wrong end in Arabic, and the icon keeps its size on the first line
 */
function StageChip({ order }: { order: BoardDelivery }) {
  const t = useT()
  const d = order.delivery
  const name = d.riderName ?? ''
  const [Icon, text, tone] = (() => {
    switch (laneOf(order)) {
      case 'waiting':
        return [Clock, order.readyAt ? t('deliveryReadyNoRider') : t('deliveryNoRider'), 'text-amber-600 dark:text-amber-500'] as const
      case 'failed':
        return [AlertTriangle, name ? t('deliveryFailedWith', { name }) : t('deliveryFailed'), 'text-amber-600 dark:text-amber-500'] as const
      case 'returned':
        return [Undo2, t('deliveryReturned'), ''] as const
      case 'cashDue':
        return [Banknote, t('deliveryCashWith', { name }), 'text-emerald-600 dark:text-emerald-500'] as const
      default:
        return d.outAt
          ? ([Bike, t('deliveryOnTheWayWith', { name }), ''] as const)
          : ([CircleDot, t('deliveryWith', { name }), ''] as const)
    }
  })()
  return (
    <span className={cn('flex min-w-0 items-start gap-1 font-medium', tone)}>
      <Icon className='mt-[0.2rem] size-3.5 shrink-0' aria-hidden />
      <span>{text}</span>
    </span>
  )
}
