import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { type ExpenseCategoryView } from '@/api/finance'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { categoriesQueryOptions } from '../queries'
import { useFinanceActions } from '../use-finance-actions'

/**
 * The category list: rename, switch off what the café never uses, add
 * one. A retired category keeps its old expenses and just leaves the
 * pickers.
 */
export function CategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const categories = useQuery({
    ...categoriesQueryOptions(true),
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('expenseCategories')}</DialogTitle>
          <DialogDescription>{t('categoriesDescription')}</DialogDescription>
        </DialogHeader>
        {categories.isLoading ? (
          <Skeleton className='h-40' />
        ) : (
          <LocalizedFields>
            <div className='divide-y'>
              {(categories.data ?? []).map((c) => (
                <CategoryRow key={String(c.id)} category={c} />
              ))}
              <NewCategoryRow order={categories.data?.length ?? 0} />
            </div>
          </LocalizedFields>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CategoryRow({ category }: { category: ExpenseCategoryView }) {
  const t = useT()
  const localized = useLocalized()
  const { saveCategory, isPending } = useFinanceActions()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState<LocalizedValue>(() =>
    toLocalizedValue(category.name)
  )

  const save = async (patch: { name?: LocalizedValue; isActive?: boolean }) => {
    try {
      await saveCategory({
        id: toNumber(category.id),
        name: fromLocalizedValue(patch.name ?? toLocalizedValue(category.name)),
        displayOrder: toNumber(category.displayOrder),
        isActive: patch.isActive ?? category.isActive,
      })
      setEditing(false)
    } catch {
      // toasted by useFinanceActions
    }
  }

  return (
    <div className='flex items-center gap-3 py-2'>
      {editing ? (
        <form
          className='flex flex-1 items-end gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            void save({ name })
          }}
        >
          <div className='flex-1'>
            <LocalizedInput
              ariaLabel={t('name')}
              value={name}
              onChange={setName}
            />
          </div>
          <Button type='submit' size='sm' disabled={isPending}>
            {isPending && <Spinner className='me-2' />}
            {t('save')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => setEditing(false)}
          >
            {t('cancel')}
          </Button>
        </form>
      ) : (
        <>
          <button
            type='button'
            className={cn(
              'flex-1 text-start text-sm hover:underline',
              !category.isActive && 'text-muted-foreground line-through'
            )}
            onClick={() => setEditing(true)}
          >
            {localized(category.name)}
          </button>
          <Switch
            checked={category.isActive}
            disabled={isPending}
            onCheckedChange={(checked) => void save({ isActive: checked })}
            aria-label={t('active')}
          />
        </>
      )}
    </div>
  )
}

function NewCategoryRow({ order }: { order: number }) {
  const t = useT()
  const { saveCategory, isPending } = useFinanceActions()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState<LocalizedValue>({ en: '', ar: '' })

  if (!adding) {
    return (
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='text-muted-foreground mt-2 h-8 px-2'
        onClick={() => setAdding(true)}
      >
        <Plus className='me-1 h-3.5 w-3.5' />
        {t('addExpenseCategory')}
      </Button>
    )
  }

  return (
    <form
      className='flex items-end gap-2 py-2'
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await saveCategory({
            id: null,
            name: fromLocalizedValue(name),
            displayOrder: order,
            isActive: true,
          })
          setName({ en: '', ar: '' })
          setAdding(false)
        } catch {
          // toasted by useFinanceActions
        }
      }}
    >
      <div className='flex-1'>
        <LocalizedInput ariaLabel={t('name')} value={name} onChange={setName} />
      </div>
      <Button
        type='submit'
        size='sm'
        disabled={isPending || (!name.en.trim() && !name.ar.trim())}
      >
        {isPending && <Spinner className='me-2' />}
        {t('save')}
      </Button>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        onClick={() => setAdding(false)}
      >
        {t('cancel')}
      </Button>
    </form>
  )
}
