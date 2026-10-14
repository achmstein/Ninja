import { AlertTriangle, Banknote, Bike, CircleDot, Clock, MapPin, Store, Undo2, UserRound } from 'lucide-react'
import { useBranchName } from '@/features/branch/use-branch-name'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/features/orders/status'
import { useNowMs } from '@/features/orders/use-pending-orders'
import { useAddressLine } from './delivery-details'
import { laneOf } from './delivery-format'
import type { BoardDelivery } from './use-deliveries'

/**
 * One delivery on the board: how it stands and since when; who and what to
 * collect; where; and its rider. Fills the column it is in. A tap opens it.
 */
export function DeliveryCard({ order, onOpen }: { order: BoardDelivery; onOpen: () => void }) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const nowMs = useNowMs()
  const line = useAddressLine()
  const sentFrom = useSentFrom()
  const lane = laneOf(order)

  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'bg-card text-card-foreground flex w-full flex-col gap-1 rounded-xl border p-3 text-start shadow-xs',
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
        {/* The name and its number share the room up to the amount; a long name is cut there.
            Each is isolated: a Latin name and "#81" would otherwise run together the wrong way in Arabic */}
        <span className='min-w-0 flex-1 truncate'>
          <bdi className='text-base font-semibold'>{order.customerName || t('guest')}</bdi>
          {/* In the till's direction, not forced left-to-right: Arabic reads the sign before the number */}
          <span className='text-muted-foreground ms-2 text-sm tabular-nums'>#{toNumber(order.orderNumber)}</span>
        </span>
        <span className='shrink-0 text-base font-semibold whitespace-nowrap tabular-nums'>{money(order.total)}</span>
      </div>
      <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
        <MapPin className='size-3.5 shrink-0' aria-hidden />
        <span className='min-w-0 truncate'>
          <bdi>{line(order.delivery)}</bdi>
        </span>
      </div>
      {order.takenAtBranchId != null && (
        <div className='text-primary flex items-center gap-1.5 text-sm font-medium'>
          <Store className='size-3.5 shrink-0' aria-hidden />
          <span className='truncate'>{sentFrom(order)}</span>
        </div>
      )}
      {order.delivery.riderName && (
        <div className='flex items-center gap-1.5 text-sm'>
          <UserRound className='text-muted-foreground size-3.5 shrink-0' aria-hidden />
          <span className='min-w-0 truncate font-medium'>
            <bdi>{order.delivery.riderName}</bdi>
          </span>
        </div>
      )}
    </button>
  )
}

/** "Sent from Downtown · Sara": a phone delivery another branch's till took and sent here */
export function useSentFrom() {
  const t = useT()
  const branchName = useBranchName()
  return (order: { takenAtBranchId?: number | string | null; takenByName?: string | null }) => {
    const branch = branchName(order.takenAtBranchId)
    return order.takenByName ? t('deliverySentFrom', { branch, name: order.takenByName }) : t('deliverySentFromNoName', { branch })
  }
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
