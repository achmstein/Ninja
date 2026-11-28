import { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assignOrderCustomerMutation } from '@ninja/api/ordering/@tanstack/react-query.gen'
import { assignTicketLinesCustomerMutation, moveTicketLinesMutation } from '@ninja/api/sales/@tanstack/react-query.gen'
import type { TicketDetail } from '@ninja/api/sales/types.gen'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { TICKET_TYPE_COUNTER, TICKET_TYPE_TABLE } from '@/lib/ticket-types'
import { toast } from '@/lib/toast'
import type { MoveTarget } from '@/features/ticket/move-target-dialog'
import type { SaleCustomer } from './cart'

/**
 * What is done to lines already on a bill: moved to another bill (one open
 * already, or a new one, which is how a bill is split), or told whose they
 * are after the fact.
 */
export function useBillLines(ticket: TicketDetail | undefined) {
  const t = useT()
  const queryClient = useQueryClient()
  const ticketId = toNumber(ticket?.id)
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
  }

  const moveLines = useMutation({ ...moveTicketLinesMutation(), onSuccess: refresh })
  // Ordering owns who an order is for; Sales keeps a snapshot on the lines
  const assignOrder = useMutation({ ...assignOrderCustomerMutation() })
  const assignLines = useMutation({ ...assignTicketLinesCustomerMutation() })

  return {
    moving: moveLines.isPending,
    assigning: assignOrder.isPending || assignLines.isPending,
    /**
     * Moves these lines where they are told to go: an open bill, a new tab or
     * table, or a fresh bill for the same place. Answers with the bill they
     * are on now
     */
    move: async (lineIds: number[], target: MoveTarget): Promise<number> => {
      const result = await moveLines.mutateAsync({
        // A retry on business Wi-Fi must not become a second command
        headers: { 'x-requestid': crypto.randomUUID() },
        path: { id: ticketId },
        body: {
          lineIds,
          targetTicketId: target.kind === 'ticket' ? target.ticketId : null,
          newTicket:
            target.kind === 'counter'
              ? { type: TICKET_TYPE_COUNTER, label: target.label }
              : target.kind === 'table'
                ? { type: TICKET_TYPE_TABLE, placeId: target.placeId }
                : null,
        },
      })
      return toNumber(result.ticketId)
    },
    /**
     * Says whose these lines are. A whole order goes through Ordering: the
     * customer owns the order and its points, so naming it moves the points
     * with it. Part of an order is a snapshot on just those lines (the bill,
     * the receipt, an account payment), the points staying where they are.
     * False when it could not be done, which is said
     */
    assign: async (lineIds: number[], customer: SaleCustomer): Promise<boolean> => {
      const chosen = new Set(lineIds)
      const byOrder = new Map<number, number[]>()
      for (const line of ticket?.lines ?? []) {
        if (line.orderId == null) continue
        const orderId = toNumber(line.orderId)
        byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), toNumber(line.id)])
      }
      const wholeOrders: number[] = []
      const loose: number[] = []
      for (const [orderId, ids] of byOrder) {
        const picked = ids.filter((id) => chosen.has(id))
        if (picked.length === 0) continue
        if (picked.length === ids.length) wholeOrders.push(orderId)
        else loose.push(...picked)
      }
      try {
        await Promise.all(
          wholeOrders.map((orderId) =>
            assignOrder.mutateAsync({
              path: { orderId },
              // A fresh id per call: the server deduplicates a retried request, and a later naming is a new one
              headers: { 'x-requestid': crypto.randomUUID() },
              body: { customerUserId: customer.id, customerName: customer.name },
            })
          )
        )
        if (loose.length > 0) {
          await assignLines.mutateAsync({
            headers: { 'x-requestid': crypto.randomUUID() },
            path: { id: ticketId },
            body: { lineIds: loose, customerId: customer.id ?? null, customerName: customer.name },
          })
        }
        refresh()
        toast.success(t('customerAssigned'))
        return true
      } catch (error) {
        // A 400 carries the domain's own words (cancelled, already somebody's)
        const detail =
          error instanceof AxiosError && typeof error.response?.data === 'string' ? error.response.data : undefined
        toast.error(t('failedToAssignCustomer'), detail ? { description: detail } : undefined)
        return false
      }
    },
  }
}
