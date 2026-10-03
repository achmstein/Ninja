import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { MenuManagement } from '@/features/menu'

const menuSearchSchema = z.object({
  q: z.string().optional(),
  // Photos: the menu as customers see it, a grid of dish cards; the list is where order is dragged
  view: z.enum(['photos']).optional(),
})

export const Route = createFileRoute('/_authenticated/menu/')({
  validateSearch: menuSearchSchema,
  component: MenuManagement,
})
