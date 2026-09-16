import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { StayHistory } from '@/features/places/history'

const historySearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  place: z.number().int().positive().optional(),
  range: z.enum(['today', '7d', '30d']).optional(),
})

export const Route = createFileRoute('/_authenticated/places/history')({
  validateSearch: historySearchSchema,
  component: StayHistory,
})
