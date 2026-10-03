import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import {
  fromLocalizedValue,
  isBlank,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type Lang,
  type LocalizedValue,
} from '@/components/localized-input'
import { FormFillButton } from '@/features/assist/form-fill-button'
import {
  localizedFields,
  mergeLocalized,
} from '@/features/assist/use-form-fill'
import { LOCALIZE_CATEGORY } from '@/features/assist/use-localize-assist'
import { useNameAssist } from '@/features/assist/use-name-assist'

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
  // The form owns its fields; its "Fill in with AI" is drawn into the header
  const [fillSlot, setFillSlot] = useState<HTMLElement | null>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader className='flex-row items-center justify-between gap-3 pe-8'>
          <DialogTitle>
            {isEditing ? t('editCategory') : t('addCategory')}
          </DialogTitle>
          <div ref={setFillSlot} className='contents' />
        </DialogHeader>
        {/* Keyed so form state resets per category; closing unmounts it */}
        <CategoryForm
          key={String(category?.id ?? 'new')}
          category={category}
          onOpenChange={onOpenChange}
          fillSlot={fillSlot}
        />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  category,
  onOpenChange,
  fillSlot,
}: {
  category: CatalogTypeDto | null
  onOpenChange: (open: boolean) => void
  /** Where the dialog's header takes the form's "Fill in with AI" */
  fillSlot: HTMLElement | null
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const isEditing = !!category

  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(category?.name)
  )
  const [error, setError] = useState('')
  const nameAssist = useNameAssist(LOCALIZE_CATEGORY, name, setName)
  /** Name languages "Fill in with AI" wrote and nobody has edited since */
  const [nameFilled, setNameFilled] = useState<Partial<Record<Lang, boolean>>>(
    {}
  )

  const applyFill = (filled: Record<string, string>) => {
    const next = mergeLocalized('name', name, filled)
    const wrote = (['en', 'ar'] as const).filter(
      (lang) => next[lang] !== name[lang]
    )
    if (wrote.length === 0) return
    setName((prev) => mergeLocalized('name', prev, filled))
    setNameFilled((prev) => ({
      ...prev,
      ...Object.fromEntries(wrote.map((lang) => [lang, true])),
    }))
    nameAssist.setLang(wrote[0])
  }

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
    if (isBlank(name)) {
      setError(t('nameIsRequired'))
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
    <LocalizedFields lang={nameAssist.lang} onLangChange={nameAssist.setLang}>
      <form onSubmit={handleSubmit} className='space-y-4'>
        {fillSlot &&
          createPortal(
            <FormFillButton
              form='a menu category'
              fields={localizedFields('name', 'Name', name)}
              onFilled={applyFill}
            />,
            fillSlot
          )}
        <LocalizedInput
          id='category-name'
          label={t('name')}
          value={name}
          onChange={(value, lang) => {
            nameAssist.onChange(value, lang)
            setNameFilled((prev) => ({ ...prev, [lang]: false }))
          }}
          error={error ?? undefined}
          autoFocus
          assist={nameAssist.slot}
          suggested={{
            en: nameAssist.suggested.en || nameFilled.en,
            ar: nameAssist.suggested.ar || nameFilled.ar,
          }}
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
            {isLoading && <Spinner />}
            {isEditing ? t('save') : t('create')}
          </Button>
        </DialogFooter>
      </form>
    </LocalizedFields>
  )
}
