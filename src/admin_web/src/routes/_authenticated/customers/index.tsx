import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'

const customersSearchSchema = z.object({
  q: z.string().optional(),
  // Owing (tab balance > 0), loyalty members, or guests who ordered
  // without an account, or the accounts switched off; nothing = the
  // directory of accounts in use
  filter: z.enum(['owing', 'members', 'guests', 'off']).optional(),
  // Selected customer in the master-detail split (identity id)
  customer: z.string().optional(),
  // Selected guest in the guests view (the key Ordering gave them)
  guest: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: customersSearchSchema,
  component: Customers,
})
