import { createFileRoute, redirect } from '@tanstack/react-router'
import { SalePad } from '@/features/sale'

type SaleSearch = {
  /** How an open bill was once addressed here; it has its own address now (`/order/$ticketId`) */
  ticket?: number
}

/** A new sale: rung up at the counter and paid on the spot, or sent out as a delivery */
export const Route = createFileRoute('/_authenticated/sale')({
  validateSearch: (search: Record<string, unknown>): SaleSearch => {
    const ticket = Number(search.ticket)
    return Number.isInteger(ticket) && ticket > 0 ? { ticket } : {}
  },
  // A link kept from before goes on to the bill it meant
  beforeLoad: ({ search }) => {
    if (search.ticket) throw redirect({ to: '/order/$ticketId', params: { ticketId: String(search.ticket) } })
  },
  component: SalePad,
})
