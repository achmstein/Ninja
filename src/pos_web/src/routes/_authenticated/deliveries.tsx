import { createFileRoute } from '@tanstack/react-router'
import { DeliveriesBoard } from '@/features/deliveries/board'

export const Route = createFileRoute('/_authenticated/deliveries')({
  component: DeliveriesBoard,
})
