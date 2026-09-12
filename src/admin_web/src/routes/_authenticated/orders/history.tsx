import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'
import { OrdersManagement } from '@/features/orders'

const ordersSearchSchema = z.object({
  ...pagedSearch,
  ...rangeSearch,
  status: z.array(z.string()).optional(),
  // Order number or customer name
  q: z.string().optional(),
  sort: z.enum(['date_desc', 'date_asc', 'total_desc', 'total_asc']).optional(),
})

export const Route = createFileRoute('/_authenticated/orders/history')({
  validateSearch: ordersSearchSchema,
  component: OrdersManagement,
})
