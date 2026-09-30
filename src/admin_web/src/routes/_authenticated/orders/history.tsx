import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { pagedSearch, rangeSearch } from '@/lib/search-schemas'

// History is now what Orders opens on
export const Route = createFileRoute('/_authenticated/orders/history')({
  validateSearch: z.object({
    ...pagedSearch,
    ...rangeSearch,
    status: z.array(z.string()).optional(),
    q: z.string().optional(),
    sort: z
      .enum(['date_desc', 'date_asc', 'total_desc', 'total_asc'])
      .optional(),
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: '/orders', search })
  },
})
