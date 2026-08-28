import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { SessionsHistory } from '@/features/rooms/history'

const historySearchSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  room: z.number().int().positive().optional(),
  range: z.enum(['today', '7d', '30d']).optional(),
})

export const Route = createFileRoute('/_authenticated/rooms/history')({
  validateSearch: historySearchSchema,
  component: SessionsHistory,
})
