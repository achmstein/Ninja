import { createFileRoute } from '@tanstack/react-router'
import { SendingTicket } from '@/features/sending/sending-ticket'

/** A new counter sale charged a moment ago, before the server has made its ticket */
export const Route = createFileRoute('/_authenticated/ticket/sending/$requestId')({
  component: SendingTicketRoute,
})

function SendingTicketRoute() {
  const { requestId } = Route.useParams()
  return <SendingTicket requestId={requestId} />
}
