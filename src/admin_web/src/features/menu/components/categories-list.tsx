import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ChevronRight, Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type CatalogTypeDto } from '@/api/catalog'
import {
  deleteCategoryMutation,
  listCategoriesOptions,
  listItemsOptions,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { CategoryDialog } from './category-dialog'

export function CategoriesList() {
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] =
    useState<CatalogTypeDto | null>(null)
  const [filter, setFilter] = useState('')

  const { data: categories = [], isLoading: categoriesLoading } = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )

  // Counts derive from the (small, fully loaded) items list
  const { data: items = [] } = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const deleteMutation = useMutation({
    ...deleteCategoryMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })
      toast.success(t('categoryDeletedSuccess'))
      setDeleteDialogOpen(false)
      setSelectedCategory(null)
    },
    onError: () => toast.error(t('failedToDeleteCategory')),
  })

  const handleAdd = () => {
    setSelectedCategory(null)
    setDialogOpen(true)
  }

  const handleEdit = (category: CatalogTypeDto) => {
    setSelectedCategory(category)
    setDialogOpen(true)
  }

  const handleDeleteClick = (category: CatalogTypeDto) => {
    setSelectedCategory(category)
    setDeleteDialogOpen(true)
  }

  const getItemCount = (categoryId: number | string | undefined) =>
    items.filter((i) => Number(i.catalogTypeId) === Number(categoryId)).length

  const selectedCount = getItemCount(selectedCategory?.id)

  const visibleCategories = useMemo(() => {
    const term = filter.trim().toLowerCase()
    return [...categories]
      .filter(
        (category) =>
          !term ||
          category.name?.en?.toLowerCase().includes(term) ||
          category.name?.ar?.includes(filter.trim())
      )
      .sort(
        (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
      )
  }, [categories, filter])

  return (
    <>
      <Header />

      <Main fixed>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex items-center gap-2'>
            <div>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('categories')}
              </h1>
              <p className='text-muted-foreground'>{t('categoriesSubtitle')}</p>
            </div>
          </div>
          <Button onClick={handleAdd}>
            <Plus className='me-2 h-4 w-4' />
            {t('addCategory')}
          </Button>
        </div>

        <div className='my-4 flex items-center sm:my-0'>
          <Input
            placeholder={t('filter')}
            className='h-9 w-40 sm:my-4 lg:w-[250px]'
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Separator className='shadow-sm' />

        {categoriesLoading ? (
          <div className='grid gap-4 pt-4 md:grid-cols-2 lg:grid-cols-3'>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className='h-32' />
            ))}
          </div>
        ) : visibleCategories.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center'>
            <Tag className='h-10 w-10 opacity-40' />
            {categories.length === 0
              ? t('noCategoriesFound')
              : t('noCategoriesMatchFilter')}
          </div>
        ) : (
          <ul className='no-scrollbar grid gap-4 overflow-auto pt-4 pb-8 md:grid-cols-2 lg:grid-cols-3'>
            {visibleCategories.map((category) => {
              const itemCount = getItemCount(category.id)
              return (
                <li
                  key={String(category.id)}
                  className='group cursor-pointer rounded-lg border p-4 transition-shadow hover:shadow-md'
                  onClick={() =>
                    navigate({
                      to: '/menu',
                      search: { category: [String(category.id)] },
                    })
                  }
                >
                  <div className='mb-6 flex items-center justify-between'>
                    <div className='bg-muted flex size-10 items-center justify-center rounded-lg p-2'>
                      <Tag className='size-5' />
                    </div>
                    <div
                      className='flex gap-1'
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-8'
                        aria-label={`${t('edit')} ${localized(category.name)}`}
                        onClick={() => handleEdit(category)}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='size-8'
                        onClick={() => handleDeleteClick(category)}
                        disabled={itemCount > 0}
                        title={
                          itemCount > 0
                            ? t('cannotDeleteCategory')
                            : t('delete')
                        }
                      >
                        <Trash2
                          className={`h-4 w-4 ${itemCount > 0 ? 'text-muted-foreground/50' : 'text-destructive'}`}
                        />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h2 className='mb-1 flex items-baseline gap-2 font-semibold'>
                      {localized(category.name)}
                    </h2>
                    {/* The whole card links to the menu filtered to this
                        category; the chevron surfaces that on hover */}
                    <p className='text-muted-foreground flex items-center justify-between text-sm'>
                      {t('itemCount', { count: itemCount })}
                      <ChevronRight className='h-4 w-4 opacity-0 transition-opacity group-hover:opacity-60 rtl:rotate-180' />
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Main>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={selectedCategory}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteCategory')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedCount > 0 ? (
                t('categoryHasItems', { count: selectedCount })
              ) : (
                <>
                  {t('deleteCategoryConfirmation', {
                    name: localized(selectedCategory?.name),
                  })}{' '}
                  {t('cannotBeUndone')}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {t('cancel')}
            </AlertDialogCancel>
            {selectedCategory && selectedCount === 0 && (
              <AlertDialogAction
                onClick={() =>
                  deleteMutation.mutate({
                    path: { id: Number(selectedCategory.id) },
                    query: { 'api-version': API_VERSION },
                  })
                }
                disabled={deleteMutation.isPending}
                className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              >
                {deleteMutation.isPending && (
                  <Loader2 className='me-2 h-4 w-4 animate-spin' />
                )}
                {t('delete')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
