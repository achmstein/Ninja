import { createFileRoute } from '@tanstack/react-router'
import LoyaltyPage from '@/features/loyalty'

export const Route = createFileRoute('/_authenticated/loyalty/')({
  component: LoyaltyPage,
})
