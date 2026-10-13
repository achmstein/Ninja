import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { FeatureGate } from '@/components/feature-gate'
import { MenuEngineering } from '@/features/inventory/menu-engineering'

const menuEngineeringSearchSchema = z.object({
  ...pagedSearch,
  q: z.string().optional(),
  // Days of sales the matrix covers; 30 when absent
  days: z.union([z.literal(7), z.literal(90)]).optional(),
})

export const Route = createFileRoute(
  '/_authenticated/inventory/menu-engineering'
)({
  validateSearch: menuEngineeringSearchSchema,
  component: () => (
    <FeatureGate feature='inventory'>
      <MenuEngineering />
    </FeatureGate>
  ),
})
