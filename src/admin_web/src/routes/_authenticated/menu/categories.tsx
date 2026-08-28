import { createFileRoute } from '@tanstack/react-router'
import { CategoriesList } from '@/features/menu/components/categories-list'

export const Route = createFileRoute('/_authenticated/menu/categories')({
  component: CategoriesList,
})
