import { useQuery } from '@tanstack/react-query'
import { type PayView } from '@/api/sales'
import {
  getBillToPayOptions,
  getPlaceBillToPayOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from './api-client'
import { offersPay } from './pay'

/** Which bill to pay: one the guest is on, or whatever is open at the
 *  table they sit at (a guest who ordered nothing themselves). */
export type PaySource =
  | { ticketId: number }
  | { placeId: number; branchId: number }

/** Every guest at the table sees the others' shares land, so an open view
 *  is re-read this often. */
const LIVE_MS = 4_000

/** Nothing will change for the guest: the café takes no payments here, or
 *  the bill is closed. */
const settled = (view: PayView | undefined) =>
  view != null && (!offersPay(view.why) || view.why === 'closed')

/**
 * The bill as a guest pays it, re-read every few seconds while `live`.
 * A 404 (nothing open at the table, or not their bill) is an answer, not
 * something to retry.
 */
export function usePayView(source: PaySource | null, { live = true, enabled = true } = {}) {
  const byTicket = source != null && 'ticketId' in source
  const options = byTicket
    ? getBillToPayOptions({
        path: { ticketId: source.ticketId },
        query: { 'api-version': API_VERSION },
      })
    : getPlaceBillToPayOptions({
        path: { placeId: source?.placeId ?? 0 },
        query: { 'api-version': API_VERSION, branchId: source?.branchId ?? 0 },
      })
  return useQuery({
    ...(options as ReturnType<typeof getBillToPayOptions>),
    enabled: enabled && source != null,
    retry: false,
    refetchInterval: (query) =>
      live && !query.state.error && !settled(query.state.data) ? LIVE_MS : false,
  })
}
