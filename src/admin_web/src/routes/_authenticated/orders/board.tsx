import { createFileRoute } from '@tanstack/react-router'
import { OrdersBoard } from '@/features/orders/board'

export const Route = createFileRoute('/_authenticated/orders/board')({
  component: OrdersBoard,
})
