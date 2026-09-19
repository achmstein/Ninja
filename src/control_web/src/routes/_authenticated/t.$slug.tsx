import { createFileRoute } from '@tanstack/react-router'
import { TenantPage } from '@/features/tenants/tenant-page'

export const Route = createFileRoute('/_authenticated/t/$slug')({
  component: TenantRoute,
})

function TenantRoute() {
  const { slug } = Route.useParams()
  return <TenantPage slug={slug} />
}
