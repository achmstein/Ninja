import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import type { OrderSummary } from '@/api/ordering/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { toNumber } from '@/lib/money'

/**
 * Customer app orders waiting for a cashier to accept them, oldest first —
 * the one that has waited longest is the one to deal with. Branch-scoped by
 * the X-Branch-Id header every request carries. SignalR is the primary
 * update path (see use-pos-notifications); the poll is only a fallback.
 */
export function usePendingOrders() {
  const query = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    refetchInterval: 60_000,
  })

  const pending = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) =>
          new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
      ),
    [query.data]
  )

  return { pending, isLoading: query.isLoading }
}

/**
 * The pending orders that will land on this ticket once confirmed: a room
 * order carries its session, a table order its table. Counter tickets never
 * match — nothing orders into them from an app.
 */
export function pendingForTicket(
  pending: OrderSummary[],
  ticket: {
    sessionId?: null | number | string
    // LEGACY(places): a table order is matched to its bill by the old tableId, not placeId — remove when Sales, Ordering and Notification stop sending the old room/table fields.
    tableId?: null | number | string
  }
): OrderSummary[] {
  const sessionId = ticket.sessionId == null ? null : toNumber(ticket.sessionId)
  // LEGACY(places): old tableId match — remove when Sales, Ordering and Notification stop sending the old room/table fields.
  const tableId = ticket.tableId == null ? null : toNumber(ticket.tableId)

  return pending.filter(
    (order) =>
      (sessionId != null &&
        order.sessionId != null &&
        toNumber(order.sessionId) === sessionId) ||
      (tableId != null &&
        order.tableId != null &&
        toNumber(order.tableId) === tableId)
  )
}

/** A clock that ticks every half minute, so ages and urgency advance without a refetch. */
export function useNowMs(intervalMs = 30_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return nowMs
}
