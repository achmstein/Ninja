import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TillRefunds } from '@/features/till/refunds'
import { pagedSearch, rangeSearch } from '@/features/till/search'

export const Route = createFileRoute('/_authenticated/till/refunds')({
  validateSearch: z.object({ ...rangeSearch, ...pagedSearch }),
  component: TillRefunds,
})
