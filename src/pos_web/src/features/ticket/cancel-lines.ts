import type { TicketLineView } from '@ninja/api/sales/types.gen'
import { toNumber } from '@/lib/money'

/**
 * Whether a line of an open bill can be cancelled: what was sold (an item, or
 * a line keyed in by hand) and still is, and not paid for already. The room's
 * time, a delivery fee and money off are not items.
 */
export function isCancellable(line: TicketLineView): boolean {
  return (
    (line.source === 'Order' || line.source === 'Manual') &&
    toNumber(line.unitPrice) > 0 &&
    toNumber(line.qty) > 0 &&
    !line.paid
  )
}
