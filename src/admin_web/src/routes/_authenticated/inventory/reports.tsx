import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { Reports } from '@/features/inventory/reports'

const reportsSearchSchema = z.object({
  ...pagedSearch,
  ...rangeSearch,
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/inventory/reports')({
  validateSearch: reportsSearchSchema,
  component: () => (
    <FeatureGate feature='inventory'>
      <Reports />
    </FeatureGate>
  ),
})
