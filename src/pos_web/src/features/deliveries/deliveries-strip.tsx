import { useState } from 'react'
import { AlertTriangle, Banknote, Bike, CircleDot, Clock, MapPin, Undo2, UserRound } from 'lucide-react'
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
      {/* One thing a line, read at a glance from across the counter: how it
          stands and since when; who and what to collect; where; and the
          rider on a line of their own, so a Latin name never splits an
          Arabic sentence */}
      <div className='flex items-center gap-2'>
        <StagePill order={order} />
        <span className='text-muted-foreground ms-auto shrink-0 text-xs whitespace-nowrap'>
          {relativeTime(order.confirmedAt ?? order.date, nowMs, t, locale)}
        </span>
      </div>
      <div className='mt-1 flex items-baseline gap-2'>
        <span className='truncate text-base font-semibold'>{order.customerName || t('guest')}</span>
        <span className='text-muted-foreground shrink-0 text-sm tabular-nums'>#{toNumber(order.orderNumber)}</span>
        <span className='ms-auto shrink-0 text-base font-semibold whitespace-nowrap tabular-nums'>{money(order.total)}</span>
      </div>
      <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
        <MapPin className='size-3.5 shrink-0' aria-hidden />
        <span className='truncate'>{line(order.delivery)}</span>
      </div>
      {order.delivery.riderName && (
        <div className='flex items-center gap-1.5 text-sm'>
          <UserRound className='text-muted-foreground size-3.5 shrink-0' aria-hidden />
          <bdi className='truncate font-medium'>{order.delivery.riderName}</bdi>
        </div>
      )}
    </button>
  )
}

/**
 * Where the delivery has got to, as a short pill: a word and an icon (never
 * colour alone), tinted by what the till should do about it. The rider's
 * name is not in it: the card gives the rider a line of their own
 */
function StagePill({ order }: { order: BoardDelivery }) {
  const t = useT()
  const amber = 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  const [Icon, text, tone] = (() => {
    switch (laneOf(order)) {
      case 'waiting':
        return [Clock, order.readyAt ? t('deliveryReadyNoRider') : t('deliveryNoRider'), amber] as const
      case 'failed':
        return [AlertTriangle, t('deliveryFailed'), amber] as const
      case 'returned':
        return [Undo2, t('deliveryReturned'), 'bg-muted text-muted-foreground'] as const
      case 'cashDue':
        return [Banknote, t('deliveryStageCashDue'), 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'] as const
      default:
        return order.delivery.outAt
          ? ([Bike, t('deliveryStageOnTheWay'), 'bg-sky-500/15 text-sky-700 dark:text-sky-400'] as const)
          : ([CircleDot, t('deliveryStageWithRider'), 'bg-muted text-foreground'] as const)
    }
  })()
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>
      <Icon className='size-3.5 shrink-0' aria-hidden />
      <span className='truncate'>{text}</span>
    </span>
  )
}
