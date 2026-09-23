import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getKitchenOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
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
  const query = useQuery({
    ...getKitchenOrdersOptions({
      query: {
        'api-version': API_VERSION,
        ...(stationId != null && { stationId }),
      },
    }),
    refetchInterval: 20_000,
  })

  const orders = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) =>
          new Date(a.confirmedAt ?? a.date ?? 0).getTime() -
          new Date(b.confirmedAt ?? b.date ?? 0).getTime()
      ),
    [query.data]
  )

  return { orders, isLoading: query.isLoading }
}

/** A clock that ticks every second, so the cards' timers run without a refetch. */
export function useNowMs(intervalMs = 1_000): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return nowMs
}
