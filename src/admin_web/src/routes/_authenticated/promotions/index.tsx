import { createFileRoute } from '@tanstack/react-router'
import { PromotionsManagement } from '@/features/promotions'

export const Route = createFileRoute('/_authenticated/promotions/')({
  component: PromotionsManagement,
})
