import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { OrdersBoard } from '@/features/orders/board'

const boardSearchSchema = z.object({
  // Group the live queue by where the order came from
  place: z.enum(['rooms', 'tables', 'counter']).optional(),
})

// Orders opens on the live queue (rooms-style IA); the paginated table
// lives on the History tab at /orders/history
export const Route = createFileRoute('/_authenticated/orders/')({
  validateSearch: boardSearchSchema,
  component: OrdersBoard,
})
