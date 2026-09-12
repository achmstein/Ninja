import { createFileRoute } from '@tanstack/react-router'
import { NotFoundError } from '@/features/errors/error-page'

export const Route = createFileRoute('/(errors)/404')({
  component: NotFoundError,
})
