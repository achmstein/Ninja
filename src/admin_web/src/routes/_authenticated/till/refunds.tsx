import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { rangeSearch } from '@/lib/search-schemas'

// The list now opens under the report on the Till page
export const Route = createFileRoute('/_authenticated/till/refunds')({
  validateSearch: z.object(rangeSearch),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/till', search: { ...search, view: 'refunds' } })
  },
})
