import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { StockCounts } from '@/features/inventory/counts'

export const Route = createFileRoute(
  '/_authenticated/inventory/history/counts'
)({
  validateSearch: z.object(pagedSearch),
  component: () => (
    <FeatureGate feature='inventory'>
      <StockCounts />
    </FeatureGate>
  ),
})
