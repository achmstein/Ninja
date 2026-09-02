import { createFileRoute } from '@tanstack/react-router'
import { ShiftScreen } from '@/features/shift'

export const Route = createFileRoute('/_authenticated/shift')({
  component: ShiftScreen,
})
