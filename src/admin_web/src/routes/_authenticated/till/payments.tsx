import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TillPayments } from '@/features/till/payments'
import { pagedSearch, rangeSearch } from '@/features/till/search'

const paymentsSearchSchema = z.object({
  ...rangeSearch,
  ...pagedSearch,
  tender: z.array(z.string()).optional(),
})

export const Route = createFileRoute('/_authenticated/till/payments')({
  validateSearch: paymentsSearchSchema,
  component: TillPayments,
})
