import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { TENANT_TABS, TenantPage } from '@/features/tenants/tenant-page'

// The open tab lives in the URL, so a link lands on the right one and the
// back button walks through them; an unknown value falls back to overview.
// `.default` on top of `.catch` keeps `?tab` optional on every Link here.
const searchSchema = z.object({
  tab: z.enum(TENANT_TABS).catch('overview').default('overview'),
})

export const Route = createFileRoute('/_authenticated/t/$slug')({
  component: TenantRoute,
  validateSearch: searchSchema,
})

function TenantRoute() {
  const { slug } = Route.useParams()
  const { tab } = Route.useSearch()
  return <TenantPage slug={slug} tab={tab} />
}
