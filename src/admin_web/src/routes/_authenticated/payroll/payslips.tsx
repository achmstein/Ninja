import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Payslips } from '@/features/payroll/payslips'

const payslipsSearchSchema = z.object({
  // yyyy-MM; the current month when absent
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_authenticated/payroll/payslips')({
  validateSearch: payslipsSearchSchema,
  component: () => (
    <FeatureGate feature='payroll'>
      <Payslips />
    </FeatureGate>
  ),
})
