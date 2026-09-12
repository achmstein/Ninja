import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { MenuManagement } from '@/features/menu'

const menuSearchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/menu/')({
  validateSearch: menuSearchSchema,
  component: MenuManagement,
})
