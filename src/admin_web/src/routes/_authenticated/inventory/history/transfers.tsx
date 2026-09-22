import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { Transfers } from '@/features/inventory/transfers'

export const Route = createFileRoute(
  '/_authenticated/inventory/history/transfers'
)({
  validateSearch: z.object(pagedSearch),
  component: () => (
    <FeatureGate feature='inventory'>
      <Transfers />
    </FeatureGate>
  ),
})
