import { createFileRoute } from '@tanstack/react-router'
import { SalePad } from '@/features/sale'

type SaleSearch = {
  /**
   * Add the picked items to this open ticket instead of ringing up a
   * walk-in: same pad, same cart, but the bill stays open and payment
   * happens later on the ticket screen.
   */
  ticket?: number
}

export const Route = createFileRoute('/_authenticated/sale')({
  validateSearch: (search: Record<string, unknown>): SaleSearch => {
    const ticket = Number(search.ticket)
    return Number.isInteger(ticket) && ticket > 0 ? { ticket } : {}
  },
  component: SaleRoute,
})

function SaleRoute() {
  const { ticket } = Route.useSearch()
  return <SalePad ticketId={ticket} />
}
