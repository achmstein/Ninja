import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { orderUrgency } from './status'
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
  const open = orders.filter((order) => order.readyAt == null && order.cancelledAt == null)
  const late = open.filter((order) => orderUrgency(order.confirmedAt ?? order.date, nowMs) === 'delayed').length
  const figure = 'text-[22px] leading-[26px] font-bold tabular-nums'

  return (
    <div className='flex items-center gap-6 px-2 max-sm:hidden'>
      <div className='text-center'>
        <div className={figure}>{open.length}</div>
        <div className='text-muted-foreground text-xs'>{t('tallyOrders')}</div>
      </div>
      <div className='text-center'>
        <div className={cn(figure, late > 0 ? 'text-destructive' : 'text-muted-foreground')}>{late}</div>
        <div className='text-muted-foreground text-xs'>{t('tallyLate')}</div>
      </div>
    </div>
  )
}
