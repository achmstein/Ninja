import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TillSalesReport } from '@/features/till'
import { rangeSearch } from '@/features/till/search'

// The till back office opens on the sales report; the lists sit beside it
export const Route = createFileRoute('/_authenticated/till/')({
  validateSearch: z.object(rangeSearch),
  component: TillSalesReport,
})
