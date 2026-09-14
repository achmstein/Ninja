import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'
import { TillReport } from '@/features/till'

const tillSearchSchema = z.object({
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

export const Route = createFileRoute('/_authenticated/till/')({
  validateSearch: tillSearchSchema,
  component: TillReport,
})
