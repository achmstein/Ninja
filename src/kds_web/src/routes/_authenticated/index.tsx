import { createFileRoute } from '@tanstack/react-router'
import { Board } from '@/features/board'

export const Route = createFileRoute('/_authenticated/')({
  component: Board,
})
