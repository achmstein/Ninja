import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { OrdersBoard } from '@/features/orders/board'

const boardSearchSchema = z.object({
  // Group the live queue by where the order came from
  place: z.enum(['rooms', 'tables', 'counter', 'delivery']).optional(),
})

export const Route = createFileRoute('/_authenticated/orders/live')({
  validateSearch: boardSearchSchema,
  component: OrdersBoard,
})
