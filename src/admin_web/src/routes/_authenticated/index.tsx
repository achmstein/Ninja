import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

const dashboardSearchSchema = z.object({
  // Trends range
  range: z.enum(['7d', '30d', '90d']).optional(),
})

export const Route = createFileRoute('/_authenticated/')({
  validateSearch: dashboardSearchSchema,
  component: Dashboard,
})
