import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type CatalogTypeDto } from '@/api/catalog'
import {
  createCategoryMutation,
  updateCategoryMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: CatalogTypeDto | null
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
}: CategoryDialogProps) {
  const t = useT()
  const isEditing = !!category

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[420px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editCategory') : t('addCategory')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('editCategoryDescription')
              : t('addCategoryDescription')}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so form state resets per category; closing unmounts it */}
        <CategoryForm
          key={String(category?.id ?? 'new')}
          category={category}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  category,
  onOpenChange,
}: {
  category: CatalogTypeDto | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const isEditing = !!category

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(category?.name)
  )
  const [error, setError] = useState('')

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
    toast.success(
      isEditing ? t('categoryUpdatedSuccess') : t('categoryCreatedSuccess')
    )
    onOpenChange(false)
  }

  const createMutation = useMutation({
    ...createCategoryMutation(),
    onSuccess,
    onError: () => toast.error(t('failedToSaveCategory')),
  })

  const updateMutation = useMutation({
    ...updateCategoryMutation(),
    onSuccess,
    onError: () => toast.error(t('failedToSaveCategory')),
  })

  const isLoading = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.en.trim()) {
      setError(t('englishNameRequired'))
      return
    }
    setError('')

    const body = {
      id: category?.id,
      name: fromLocalizedValue(name),
      displayOrder: category?.displayOrder,
    }

    if (isEditing) {
      updateMutation.mutate({
        path: { id: Number(category.id) },
        body,
        query: { 'api-version': API_VERSION },
      })
    } else {
      createMutation.mutate({
        body,
        query: { 'api-version': API_VERSION },
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <LocalizedInput
        id='category-name'
        label={t('name')}
        value={name}
        onChange={setName}
        placeholder={{ en: t('categoryNameHint'), ar: 'مثال: مشروبات' }}
        error={error ?? undefined}
        autoFocus
      />

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={isLoading}>
          {isLoading && <Spinner className='me-2' />}
          {isEditing ? t('update') : t('create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
