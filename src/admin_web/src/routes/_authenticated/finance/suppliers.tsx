import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Suppliers } from '@/features/finance/suppliers'

const suppliersSearchSchema = z.object({
  // The supplier whose sheet is open
  supplier: z.number().int().positive().optional(),
  // Also list retired suppliers
  inactive: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/finance/suppliers')({
  validateSearch: suppliersSearchSchema,
  component: () => (
    <FeatureGate feature='finance'>
      <Suppliers />
    </FeatureGate>
  ),
})
