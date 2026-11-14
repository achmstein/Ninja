import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { NewTenantPage } from '@/features/tenants/new-tenant'

// A request from the site opens the form filled in with what it carried
const searchSchema = z.object({
  lead: z.number().int().positive().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/new')({
  component: NewTenantPage,
  validateSearch: searchSchema,
})
