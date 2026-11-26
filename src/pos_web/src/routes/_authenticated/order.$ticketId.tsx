import { createFileRoute, redirect } from '@tanstack/react-router'
import { SalePad } from '@/features/sale'

/**
 * An open bill (a table, a room, a tab) as the order screen: the menu beside
 * what is on it. The bill is what the address names; a new sale is `/sale`.
 */
export const Route = createFileRoute('/_authenticated/order/$ticketId')({
  // Not a bill's number: there is nothing to open
  beforeLoad: ({ params }) => {
    const id = Number(params.ticketId)
    if (!Number.isInteger(id) || id <= 0) throw redirect({ to: '/' })
  },
  component: OrderRoute,
})

function OrderRoute() {
  const { ticketId } = Route.useParams()
  return <SalePad ticketId={Number(ticketId)} />
}
