import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TillShifts } from '@/features/till/shifts'

// Closed shifts come back as a bare page with no total, so only the page
// number lives in the URL
export const Route = createFileRoute('/_authenticated/till/shifts')({
  validateSearch: z.object({
    page: z.number().int().positive().optional(),
  }),
  component: TillShifts,
})
