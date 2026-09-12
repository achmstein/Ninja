import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { rangeSearch } from '@/lib/search-schemas'
import { TillShifts } from '@/features/till/shifts'

// Closed shifts come back as a bare page with no total, so only the page
// number and the business-day window live in the URL
export const Route = createFileRoute('/_authenticated/till/shifts')({
  validateSearch: z.object({
    ...rangeSearch,
    page: z.number().int().positive().optional(),
  }),
  component: TillShifts,
})
