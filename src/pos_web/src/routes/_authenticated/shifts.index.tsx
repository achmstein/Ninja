import { createFileRoute } from '@tanstack/react-router'
import { ShiftHistory } from '@/features/shift/history'

export const Route = createFileRoute('/_authenticated/shifts/')({
  component: ShiftHistory,
})
