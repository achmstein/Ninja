import { createFileRoute } from '@tanstack/react-router'
import { GeneralError } from '@/features/errors/error-page'

export const Route = createFileRoute('/(errors)/500')({
  component: GeneralError,
})
