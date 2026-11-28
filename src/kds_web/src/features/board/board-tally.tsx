import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { allItemsCancelled, orderUrgency } from './status'
import { useKitchenOrders, useNowMs } from './use-kitchen-orders'

/**
 * What is waiting, said once in the header: how many orders are open and how
 * many of them are late. Read across the kitchen without counting tickets.
 * A cancelled order is neither: it is waiting only to be cleared.
 */
export function BoardTally() {
  const t = useT()
  // The count changes by the minute, not the second
  const nowMs = useNowMs(10_000)
  const { orders } = useKitchenOrders()
  // One whose every item was cancelled has nothing left to make either
  const open = orders.filter(
    (order) => order.readyAt == null && order.cancelledAt == null && !allItemsCancelled(order.items),
  )
  const late = open.filter((order) => orderUrgency(order.confirmedAt ?? order.date, nowMs) === 'delayed').length

  return (
    <div className='flex items-center gap-6 px-2 max-sm:hidden'>
      <div className='text-center'>
        <div className='type-tally'>{open.length}</div>
        <div className='text-muted-foreground type-caption'>{t('tallyOrders')}</div>
      </div>
      <div className='text-center'>
        <div className={cn('type-tally', late > 0 ? 'text-destructive' : 'text-muted-foreground')}>{late}</div>
        <div className='text-muted-foreground type-caption'>{t('tallyLate')}</div>
      </div>
    </div>
  )
}
