import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { serverNow } from '@/lib/server-clock'
import { boardQueries } from './api/queries'
import { useStation } from './use-station'

/**
 * The kitchen's queue for the active branch, oldest first — the order that
 * has waited longest is the one to make next. Branch-scoped by the
 * X-Branch-Id header every request carries; on a station's screen, only
 * the orders with a part there, with only its lines and its part's ready
 * time. SignalR is the primary update path (see use-kitchen-notifications);
 * the poll is only a fallback, and a short one, because a card that is not
 * there yet is a customer waiting.
 */
export function useKitchenOrders() {
  const { stationId } = useStation()
  const query = useQuery(boardQueries.orders(stationId))

  const orders = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) => new Date(a.confirmedAt ?? a.date ?? 0).getTime() - new Date(b.confirmedAt ?? b.date ?? 0).getTime()
      ),
    [query.data]
  )

  return { orders, isLoading: query.isLoading }
}

/** A clock that ticks every second, so the cards' timers run without a refetch. */
export function useNowMs(intervalMs = 1_000): number {
  const [nowMs, setNowMs] = useState(() => serverNow())

  useEffect(() => {
    const id = setInterval(() => setNowMs(serverNow()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return nowMs
}
