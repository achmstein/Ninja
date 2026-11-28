import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import type { BillView } from '@ninja/api/sales'
import { getTicketReceiptOptions } from '@ninja/api/sales/@tanstack/react-query.gen'
import { isSettled } from '@/lib/bills'

/** The printed receipt, once the bill is settled; a bill known to be open is not asked for */
export function useReceipt(ticketId: number, bill?: BillView) {
  const auth = useAuth()
  return useQuery({
    ...getTicketReceiptOptions({ path: { id: ticketId } }),
    retry: false,
    enabled: auth.isAuthenticated && (bill == null || isSettled(bill)),
  })
}
