import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Customers } from '@/features/customers'
import { customerSorts } from '@/features/customers/sort'

const customersSearchSchema = z.object({
  q: z.string().optional(),
  // Owing (tab balance > 0), loyalty members, or guests who ordered
  // without an account, or the accounts switched off; nothing = the
  // directory of accounts in use
  filter: z.enum(['owing', 'members', 'guests', 'off']).optional(),
  // What the list is sorted by; nothing = what the view is about
  sort: z.enum(customerSorts).optional(),
  // The customer whose page is open (identity id)
  customer: z.string().optional(),
  // The guest whose page is open (the key Ordering gave them)
  guest: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/customers/')({
  validateSearch: customersSearchSchema,
  component: Customers,
})
