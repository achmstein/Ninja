import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getTicketReceiptOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { BillView } from '@/api/sales'
import { API_VERSION } from '@/lib/api-client'
import { isSettled } from '@/lib/bills'

/** The printed receipt, once the bill is settled; a bill known to be open is not asked for */
export function useReceipt(ticketId: number, bill?: BillView) {
  const auth = useAuth()
  return useQuery({
    ...getTicketReceiptOptions({ path: { id: ticketId }, query: { 'api-version': API_VERSION } }),
    retry: false,
    enabled: auth.isAuthenticated && (bill == null || isSettled(bill)),
  })
}
