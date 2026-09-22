import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Expenses } from '@/features/finance/expenses'

const expensesSearchSchema = z.object({
  // yyyy-MM; the current month when absent
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_authenticated/finance/expenses')({
  validateSearch: expensesSearchSchema,
  component: () => (
    <FeatureGate feature='finance'>
      <Expenses />
    </FeatureGate>
  ),
})
