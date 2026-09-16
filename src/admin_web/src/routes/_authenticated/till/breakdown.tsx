import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { rangeSearch } from '@/lib/search-schemas'
import { TillBreakdown } from '@/features/till/breakdown'

export const Route = createFileRoute('/_authenticated/till/breakdown')({
  validateSearch: z.object(rangeSearch),
  component: TillBreakdown,
})
