import { createFileRoute } from '@tanstack/react-router'
import { TillReport } from '@/features/till'
import { tillSearchSchema } from '@/features/till/search'

export const Route = createFileRoute('/_authenticated/till/')({
  validateSearch: tillSearchSchema,
  component: TillReport,
})
