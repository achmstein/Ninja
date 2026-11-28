import { createFileRoute, redirect } from '@tanstack/react-router'
import { SalePad } from '@/features/sale'

type OrderSearch = {
  /** Opened to be paid at once: one person's part, split off its bill */
  pay?: boolean
  /** The bill it was split from: where the till goes once this one is paid */
  back?: number
}

/**
 * An open bill (a table, a room, a tab) as the order screen: the menu beside
 * what is on it. The bill is what the address names; a new sale is `/sale`.
 */
export const Route = createFileRoute('/_authenticated/order/$ticketId')({
  validateSearch: (search: Record<string, unknown>): OrderSearch => {
    const back = Number(search.back)
    return {
      pay: search.pay === true || search.pay === 'true' ? true : undefined,
      back: Number.isInteger(back) && back > 0 ? back : undefined,
    }
  },
  // Not a bill's number: there is nothing to open
  beforeLoad: ({ params }) => {
    const id = Number(params.ticketId)
    if (!Number.isInteger(id) || id <= 0) throw redirect({ to: '/' })
  },
  component: OrderRoute,
})

function OrderRoute() {
  const { ticketId } = Route.useParams()
  const { pay, back } = Route.useSearch()
  // Keyed by the bill: going from one bill to another starts the screen clean
  return <SalePad key={ticketId} ticketId={Number(ticketId)} payOnArrival={pay === true} backTo={back} />
}
