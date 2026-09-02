import { createFileRoute } from '@tanstack/react-router'
import { Floor } from '@/features/floor'

export const Route = createFileRoute('/_authenticated/')({
  component: Floor,
})
