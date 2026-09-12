import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { Purchases } from '@/features/inventory/purchases'

export const Route = createFileRoute(
  '/_authenticated/inventory/history/purchases'
)({
  validateSearch: z.object(pagedSearch),
  component: Purchases,
})
