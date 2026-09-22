import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Stock } from '@/features/inventory/stock'

const stockSearchSchema = z.object({
  // Selected stock item in the master-detail split
  item: z.number().int().positive().optional(),
  q: z.string().optional(),
  // Only items at or below their reorder level
  low: z.boolean().optional(),
  // Also list retired items (greyed, at the end) so one can be restored
  retired: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/inventory/')({
  validateSearch: stockSearchSchema,
  component: () => (
    <FeatureGate feature='inventory'>
      <Stock />
    </FeatureGate>
  ),
})
