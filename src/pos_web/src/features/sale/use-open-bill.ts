import { useEffect } from 'react'
import { AxiosError } from 'axios'
import { useQuery } from '@tanstack/react-query'
import { getTicketOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
import { toNumber } from '@/lib/money'
import { isRunning } from '@/features/places/status'
import { useStay } from '@/features/places/use-places'
import { landSend, sendsFor, useSending } from '@/features/sending/sending'

/**
 * The open bill the sale pad is rung onto, read here so the pad is the bill:
 * its lines as the server has them, the ones charged a moment ago that it has
 * not confirmed yet (features/sending), and the room's clock while it runs.
 * Nothing when the pad is a new sale.
 */
export function useOpenBill(ticketId: number | undefined) {
  const on = ticketId !== undefined
  const sends = useSending((s) => s.sends)
  const landed = useSending((s) => s.landed)
  const mySends = on ? sendsFor(sends, ticketId) : []
  const placedHere = mySends.some((x) => x.status === 'placed')

  const query = useQuery({
    ...getTicketOptions({
      path: { id: ticketId ?? 0 },
    }),
    enabled: on,
    // A discarded or deleted bill 404s: no point asking again
    retry: (count, error) => !(error instanceof AxiosError && error.response?.status === 404) && count < 3,
    // Quick while an order the server took is still to show its lines here
    refetchInterval: placedHere ? 700 : 20_000,
  })
  const ticket = on ? query.data : undefined

  // An order's lines are on the bill: its faded copy goes, the real ones tick
  useEffect(() => {
    if (!ticket) return
    const orderIds = new Set((ticket.lines ?? []).map((l) => toNumber(l.orderId)))
    for (const send of mySends) {
      if (send.status === 'placed' && send.orderId != null && orderIds.has(send.orderId)) {
        landSend(send.requestId, send.orderId)
      }
    }
  }, [ticket, mySends])

  const closed = ticket != null && (ticket.status === 'Settled' || ticket.voidedAt != null)
  const stay = useStay(ticket?.sessionId, ticket?.sessionId != null && !closed)

  return {
    query,
    ticket,
    /** The bill is no longer there (discarded, or deleted under the screen) */
    gone: on && query.isError && query.error instanceof AxiosError && query.error.response?.status === 404,
    /** Paid or voided: nothing more is rung onto it */
    closed,
    mySends,
    /** Charged here and still on their way: part of the total, and holding the payment */
    onTheirWay: mySends.filter((x) => x.status !== 'failed'),
    landed,
    stay,
    runningStay: stay && isRunning(stay) ? stay : undefined,
  }
}
