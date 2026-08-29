import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { OrdersManagement } from '@/features/orders'

const ordersSearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  status: z.array(z.string()).optional(),
  range: z.enum(['today', '7d', '30d']).optional(),
})

export const Route = createFileRoute('/_authenticated/orders/history')({
  validateSearch: ordersSearchSchema,
  component: OrdersManagement,
})
