import { createFileRoute } from '@tanstack/react-router'
import { ForbiddenError } from '@/features/errors/error-page'

export const Route = createFileRoute('/(errors)/403')({
  component: ForbiddenError,
})
