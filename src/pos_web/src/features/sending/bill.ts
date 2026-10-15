import type { TicketDetail } from '@/api/sales/types.gen'
import { toNumber } from '@/lib/money'

const money = (value: number) => Math.round(value * 100) / 100

/**
 * What an open bill comes to once lines still on their way land on it: the
 * same arithmetic as `Ticket.ComputeBill` in Sales, under the rules the bill
 * was last priced by (its VAT, and its service charge where it is served).
 * The till shows this the moment the cashier charges; the server's own
 * figure replaces it once the lines are in.
 */
export function totalWith(ticket: TicketDetail, extra: number): number {
  const lines = ticket.lines ?? []
  const subtotal = lines.reduce((sum, l) => sum + toNumber(l.total), 0) + extra

  // A percent follows the lines as they land; a fixed amount never exceeds what is there
  const discount =
    subtotal <= 0
      ? 0
      : ticket.discountRate != null
        ? money(subtotal * toNumber(ticket.discountRate))
        : Math.min(toNumber(ticket.discount), subtotal)
  const discounted = subtotal - discount

  // Service is for being served: a counter sale is not, and room time is not an order
  let served =
    ticket.type === 'Counter'
      ? 0
      : lines
          .filter((l) => l.source !== 'SessionTime')
          .reduce((sum, l) => sum + toNumber(l.total), 0) + extra
  if (subtotal > 0) served *= discounted / subtotal
  const service = money(Math.max(0, served) * toNumber(ticket.serviceChargeRate))

  const taxable = discounted + service
  const vatRate = toNumber(ticket.vatRate)
  return ticket.vatIncluded ? taxable : taxable + money(taxable * vatRate)
}
