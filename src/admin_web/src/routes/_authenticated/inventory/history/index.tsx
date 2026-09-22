import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { Movements } from '@/features/inventory/movements'

const movementsSearchSchema = z.object({
  ...pagedSearch,
  ...rangeSearch,
  stockItemId: z.number().int().positive().optional(),
  // MovementType as the API numbers it
  type: z.number().int().min(0).max(6).optional(),
})

export const Route = createFileRoute('/_authenticated/inventory/history/')({
  validateSearch: movementsSearchSchema,
  component: () => (
    <FeatureGate feature='inventory'>
      <Movements />
    </FeatureGate>
  ),
})
