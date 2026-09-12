import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { Transfers } from '@/features/inventory/transfers'

export const Route = createFileRoute(
  '/_authenticated/inventory/history/transfers'
)({
  validateSearch: z.object(pagedSearch),
  component: Transfers,
})
