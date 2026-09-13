import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Employees } from '@/features/payroll/employees'

const employeesSearchSchema = z.object({
  // The employee whose sheet is open
  employee: z.number().int().positive().optional(),
  new: z.boolean().optional(),
  // Also list people who left
  inactive: z.boolean().optional(),
})

export const Route = createFileRoute('/_authenticated/payroll/employees')({
  validateSearch: employeesSearchSchema,
  component: Employees,
})
