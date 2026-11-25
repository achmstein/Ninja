import { useQuery } from '@tanstack/react-query'
import { listOnlinePaymentsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBrand } from '@/lib/brand'

/**
 * What guests paid on this bill from their phones. The SignalR ticket nudge
 * refreshes it (a payment landing publishes one); while somebody is at the
 * provider's checkout it also polls every 5s, so the bill unlocks the moment
 * they finish, and otherwise keeps the ticket screen's 20s fallback.
 * Read wherever the plan includes online payments, switched on or not: what
 * guests already paid stays on the bill after the owner switches them off.
 * Not asked at all outside the plan, where the gateway answers 402.
 */
export function useOnlinePayments(ticketId: number, enabled: boolean) {
  const brand = useBrand()
  const inPlan = brand?.features?.onlinePayments === true || brand?.entitlements?.onlinePayments === true
  const query = useQuery({
    ...listOnlinePaymentsOptions({
      path: { ticketId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: enabled && inPlan,
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === 'Pending') ? 5_000 : 20_000,
  })
  return {
    payments: (enabled && inPlan ? query.data : undefined) ?? [],
    isLoading: query.isLoading,
  }
}
