import { createFileRoute } from '@tanstack/react-router'
import { PromoCodesManagement } from '@/features/promotions'

export const Route = createFileRoute('/_authenticated/promos/')({
  component: PromoCodesManagement,
})
