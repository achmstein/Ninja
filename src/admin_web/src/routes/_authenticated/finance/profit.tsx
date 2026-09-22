import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Profit } from '@/features/finance/profit'

const profitSearchSchema = z.object({
  // yyyy-MM; the current month when absent
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_authenticated/finance/profit')({
  validateSearch: profitSearchSchema,
  component: () => (
    <FeatureGate feature='finance'>
      <Profit />
    </FeatureGate>
  ),
})
