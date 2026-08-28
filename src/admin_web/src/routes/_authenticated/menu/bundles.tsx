import { createFileRoute } from '@tanstack/react-router'
import { BundleDeals } from '@/features/menu/bundles'

export const Route = createFileRoute('/_authenticated/menu/bundles')({
  component: BundleDeals,
})
