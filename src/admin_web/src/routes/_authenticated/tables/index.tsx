import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TablesManagement } from '@/features/tables'

const tablesSearchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  // The table whose sheet is open
  table: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/tables/')({
  validateSearch: tablesSearchSchema,
  component: TablesManagement,
})
