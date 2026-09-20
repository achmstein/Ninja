import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { PlatformPage } from '@/features/platform'

// The dashboard's tab lives in the URL so a refresh or a shared link lands
// on the same list; an unknown value falls back to the tenants. `.default`
// on top of `.catch` is what makes `?tab` optional on every Link to '/':
// zod 4 keeps a caught key required on the input side.
const searchSchema = z.object({
  tab: z
    .enum(['tenants', 'capacity', 'backups', 'audit'])
    .catch('tenants')
    .default('tenants'),
})

export const Route = createFileRoute('/_authenticated/')({
  component: PlatformPage,
  validateSearch: searchSchema,
})
