import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { getAccountBalanceOptions } from '@/api/accounts/@tanstack/react-query.gen'
import type { AccountSummaryViewModel } from '@/api/accounts/types.gen'
import { getAccountOptions } from '@/api/loyalty/@tanstack/react-query.gen'
import type { AccountDto } from '@/api/loyalty/types.gen'
import { recordTabPaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'

// What the till may know about a customer: their points, as information,
// and their tab, which it can take money against. Both are read by the
// customer's Keycloak id — a bare name on a sale has neither.

const STALE_MS = 30_000

/** 404 from either service means "none yet", not an error. */
const isNotFound = (error: unknown) =>
  error instanceof AxiosError && error.response?.status === 404

/** The customer's loyalty account, or null when they never joined. */
export function useLoyalty(userId: string | null | undefined, enabled = true) {
  const query = useQuery({
    ...getAccountOptions({
      path: { userId: userId ?? '' },
      query: { 'api-version': API_VERSION },
    }),
    enabled: enabled && !!userId,
    retry: false,
    staleTime: STALE_MS,
  })
  return {
    ...query,
    account: (query.data ?? null) as AccountDto | null,
    notEnrolled: query.isError && isNotFound(query.error),
    isError: query.isError && !isNotFound(query.error),
  }
}

/** The customer's tab balance (positive = owed), or null when they have no tab. */
export function useTab(customerId: string | null | undefined, enabled = true) {
  const query = useQuery({
    // Accounts is unversioned at the service; the gateway's api-version
    // comes from the shared axios defaults
    ...getAccountBalanceOptions({ path: { customerId: customerId ?? '' } }),
    enabled: enabled && !!customerId,
    retry: false,
    staleTime: STALE_MS,
  })
  return {
    ...query,
    tab: (query.data ?? null) as AccountSummaryViewModel | null,
    noTab: query.isError && isNotFound(query.error),
    isError: query.isError && !isNotFound(query.error),
  }
}

/**
 * Forget what the till knows about a customer's balances: after a bill goes
 * on their tab, or a payment comes off it. Accounts posts both off the bus,
 * so the next read may still be a beat behind — the card reads again when
 * it opens.
 */
export function invalidateCustomer(queryClient: QueryClient, customerId: string) {
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'getAccountBalance', path: { customerId } }],
  })
  queryClient.invalidateQueries({
    queryKey: [{ _id: 'getAccount', path: { userId: customerId } }],
  })
}

/** Record money taken against a tab; refreshes the tab and the shift chip. */
export function usePayTab(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...recordTabPaymentMutation(),
    onSuccess: () => {
      invalidateCustomer(queryClient, customerId)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getShift' }] })
    },
  })
}
