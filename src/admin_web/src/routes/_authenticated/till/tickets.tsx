import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/features/till/search'
import { TillTickets } from '@/features/till/tickets'

const ticketsSearchSchema = z.object({
  ...rangeSearch,
  ...pagedSearch,
  status: z.enum(['settled', 'open', 'voided']).optional(),
  // A receipt number finds one bill and ignores the window
  receipt: z.number().int().positive().optional(),
})

export const Route = createFileRoute('/_authenticated/till/tickets')({
  validateSearch: ticketsSearchSchema,
  component: TillTickets,
})
