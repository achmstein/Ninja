import { useQuery } from '@tanstack/react-query'
import { listOnlinePaymentsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'

/**
 * What guests paid on this bill from their phones. The SignalR ticket nudge
 * refreshes it (a payment landing publishes one); while somebody is at the
 * provider's checkout it also polls every 5s, so the bill unlocks the moment
 * they finish, and otherwise keeps the ticket screen's 20s fallback.
 * Off entirely when the café has no online payments: the gateway answers 402.
 */
export function useOnlinePayments(ticketId: number, enabled: boolean) {
  const features = useFeatures()
  const query = useQuery({
    ...listOnlinePaymentsOptions({
      path: { ticketId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: enabled && features.onlinePayments,
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === 'Pending') ? 5_000 : 20_000,
  })
  return {
    payments: (enabled && features.onlinePayments ? query.data : undefined) ?? [],
    isLoading: query.isLoading,
  }
}
