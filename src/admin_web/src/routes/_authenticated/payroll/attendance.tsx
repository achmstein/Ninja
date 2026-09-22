import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { FeatureGate } from '@/components/feature-gate'
import { Attendance } from '@/features/payroll/attendance'

const attendanceSearchSchema = z.object({
  // yyyy-MM; the current month when absent
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/_authenticated/payroll/attendance')({
  validateSearch: attendanceSearchSchema,
  component: () => (
    <FeatureGate feature='payroll'>
      <Attendance />
    </FeatureGate>
  ),
})
