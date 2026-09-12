import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'

const customersSearchSchema = z.object({
  q: z.string().optional(),
  // Owing (tab balance > 0) or loyalty members; nothing = the directory
  filter: z.enum(['owing', 'members']).optional(),
  // Selected customer in the master-detail split (identity id)
  customer: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: customersSearchSchema,
  component: Customers,
})
