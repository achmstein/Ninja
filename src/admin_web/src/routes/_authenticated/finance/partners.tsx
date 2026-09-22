import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Partners } from '@/features/finance/partners'

const partnersSearchSchema = z.object({
  // The partner whose sheet is open
  partner: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/finance/partners')({
  validateSearch: partnersSearchSchema,
  component: () => (
    <FeatureGate feature='finance'>
      <Partners />
    </FeatureGate>
  ),
})
