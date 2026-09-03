import { createFileRoute } from '@tanstack/react-router'
import { TicketScreen } from '@/features/ticket'

type TicketSearch = {
  /** Auto-open the settle dialog on arrival (the sale pad's charge flow). */
  settle?: boolean
  /** The receipts list opened this bill, so Back returns there. */
  from?: 'receipts'
}

export const Route = createFileRoute('/_authenticated/ticket/$ticketId')({
  validateSearch: (search: Record<string, unknown>): TicketSearch => ({
    settle:
      search.settle === true || search.settle === 'true' ? true : undefined,
    from: search.from === 'receipts' ? 'receipts' : undefined,
  }),
  component: TicketRoute,
})

function TicketRoute() {
  const { ticketId } = Route.useParams()
  const { settle, from } = Route.useSearch()
  return (
    <TicketScreen
      ticketId={Number(ticketId)}
      autoSettle={settle === true}
      backTo={from === 'receipts' ? '/receipts' : '/'}
    />
  )
}
