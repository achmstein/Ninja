import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { StockCounts } from '@/features/inventory/counts'

export const Route = createFileRoute(
  '/_authenticated/inventory/history/counts'
)({
  validateSearch: z.object(pagedSearch),
  component: StockCounts,
})
