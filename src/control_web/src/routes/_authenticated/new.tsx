import { createFileRoute } from '@tanstack/react-router'
import { NewTenantPage } from '@/features/tenants/new-tenant'

export const Route = createFileRoute('/_authenticated/new')({
  component: NewTenantPage,
})
