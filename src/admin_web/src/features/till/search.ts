import { z } from 'zod'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'

/**
 * The till's URL: the range, a page of a list, and which list is open. One
 * schema for the report (where a number opens its list under it) and the Bills
 * tab (the bills list on its own), so the list reads the same either way.
 */
export const tillSearchSchema = z.object({
  ...rangeSearch,
  ...pagedSearch,
  // The list opened under the report
  view: z.enum(['tickets', 'payments', 'refunds', 'tab-payments']).optional(),
  // Tickets: which book; Payments: one PaymentTender value
  status: z.enum(['settled', 'open', 'voided']).optional(),
  tender: z.string().optional(),
  // A receipt number finds one bill and ignores the window
  receipt: z.number().int().positive().optional(),
})
