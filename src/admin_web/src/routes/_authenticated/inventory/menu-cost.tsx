import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { pagedSearch } from '@/lib/search-schemas'
import { MenuCost } from '@/features/inventory/menu-cost'

const menuCostSearchSchema = z.object({
  ...pagedSearch,
  q: z.string().optional(),
  // Food-cost % above which an item is flagged; the default when absent
  target: z.number().int().min(1).max(99).optional(),
})

export const Route = createFileRoute('/_authenticated/inventory/menu-cost')({
  validateSearch: menuCostSearchSchema,
  component: MenuCost,
})
