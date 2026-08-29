import { createFileRoute } from '@tanstack/react-router'
import { OrdersBoard } from '@/features/orders/board'

// Orders opens on the live queue (rooms-style IA); the paginated table
// lives behind the History icon at /orders/history
export const Route = createFileRoute('/_authenticated/orders/')({
  component: OrdersBoard,
})
