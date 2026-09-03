import { createFileRoute } from '@tanstack/react-router'
import { Availability } from '@/features/availability'

export const Route = createFileRoute('/_authenticated/availability')({
  component: Availability,
})
