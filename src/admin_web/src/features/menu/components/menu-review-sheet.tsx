import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { type CatalogTypeDto, type MenuProposal } from '@/api/catalog'
import {
  createCategoryMutation,
  createItemMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import {
  fromLocalizedValue,
  LocalizedFields,
  LocalizedInput,
} from '@/components/localized-input'
import { hasText } from '@/features/assist/helpers'
import {
  isReviewCategoryReady,
  isReviewItemReady,
  NEW_CATEGORY,
  type ReviewCategory,
  type ReviewItem,
  toReviewCategories,
} from '../menu-scan'

type MenuReviewSheetProps = {
  proposal: MenuProposal
  categories: CatalogTypeDto[]
  onOpenChange: (open: boolean) => void
}

/**
 * What the assistant read off the menu photo, section by section, for
 * checking before anything is created: fix a name or a price, send a
 * section to an existing category or let it become a new one, untick what
 * is not wanted (what is already on the menu starts unticked). Confirming
 * creates the new categories, then the items, one by one; a failure leaves
 * the sheet open with what was created remembered, so a retry never makes
 * the same thing twice.
 */
export function MenuReviewSheet({
  proposal,
  categories,
  onOpenChange,
}: MenuReviewSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const createCategory = useMutation(createCategoryMutation())
  const createItem = useMutation(createItemMutation())

  const [sections, setSections] = useState<ReviewCategory[]>(() =>
    toReviewCategories(proposal)
  )
  const [creating, setCreating] = useState<{
    done: number
    total: number
  } | null>(null)

  const updateSection = (key: number, patch: Partial<ReviewCategory>) =>
    setSections((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, ...patch } : section
      )
    )

  const updateItem = (key: number, patch: Partial<ReviewItem>) =>
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.key === key ? { ...item, ...patch } : item
        ),
      }))
    )

  const included = sections
    .map((section) => ({
      section,
      items: section.items.filter((item) => item.include),
    }))
    .filter(({ items }) => items.length > 0)
  const count = included.reduce((sum, { items }) => sum + items.length, 0)

  const confirm = async () => {
    if (count === 0) {
      toast.error(t('noItemsSelected'))
      return
    }
    if (!included.every(({ items }) => items.every(isReviewItemReady))) {
      toast.error(t('itemNeedsNameAndPrice'))
      return
    }
    if (!included.every(({ section }) => isReviewCategoryReady(section))) {
      toast.error(t('sectionNeedsCategory'))
      return
    }

    let done = included.reduce(
      (sum, { items }) => sum + items.filter((i) => i.createdId != null).length,
      0
    )
    setCreating({ done, total: count })
    let newCategories = 0
    try {
      for (const { section, items } of included) {
        let catalogTypeId: number
        if (section.catalogTypeId !== NEW_CATEGORY) {
          catalogTypeId = Number(section.catalogTypeId)
        } else if (section.createdId != null) {
          catalogTypeId = section.createdId
        } else {
          const created = await createCategory.mutateAsync({
            body: {
              name: fromLocalizedValue(section.name),
              displayOrder: categories.length + newCategories++,
            },
            query: { 'api-version': API_VERSION },
          })
          catalogTypeId = toNumber(created.id)
          updateSection(section.key, { createdId: catalogTypeId })
        }

        for (const [index, item] of items.entries()) {
          if (item.createdId != null) continue
          const created = await createItem.mutateAsync({
            body: {
              name: fromLocalizedValue(item.name),
              description: fromLocalizedValue(item.description),
              price: parseFloat(item.price),
              catalogTypeId,
              isAvailable: true,
              isOnOffer: false,
              offerPrice: null,
              isPopular: false,
              preparationTimeMinutes: null,
              displayOrder: index,
            },
            query: { 'api-version': API_VERSION },
          })
          updateItem(item.key, { createdId: toNumber(created.id) })
          setCreating({ done: ++done, total: count })
        }
      }
    } catch {
      toast.error(t('failedToSaveItem'))
      setCreating(null)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })
      return
    }

    setCreating(null)
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })
    toast.success(t('menuScanCreated', { count }))
    onOpenChange(false)
  }

  return (
    <Sheet open onOpenChange={(open) => !creating && onOpenChange(open)}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl'>
        <SheetHeader className='border-b'>
          <SheetTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary size-4' aria-hidden />
            {t('reviewMenuScan')}
          </SheetTitle>
        </SheetHeader>

        <LocalizedFields>
          <div className='space-y-4 p-4'>
            {(proposal.warnings.length > 0 || proposal.notes) && (
              <Alert>
                <AlertTriangle />
                <AlertTitle>{t('toastWarning')}</AlertTitle>
                <AlertDescription>
                  <ul className='list-disc space-y-0.5 ps-4'>
                    {proposal.notes && <li>{proposal.notes}</li>}
                    {proposal.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {sections.map((section) => {
              const ticked = section.items.filter((i) => i.include).length
              return (
                <section key={section.key} className='rounded-lg border'>
                  <div className='bg-muted/40 flex flex-wrap items-center gap-2 border-b p-3'>
                    <Checkbox
                      aria-label={t('selectAll')}
                      checked={
                        ticked === 0
                          ? false
                          : ticked === section.items.length
                            ? true
                            : 'indeterminate'
                      }
                      onCheckedChange={(checked) =>
                        updateSection(section.key, {
                          items: section.items.map((item) => ({
                            ...item,
                            include: checked === true,
                          })),
                        })
                      }
                    />
                    <LocalizedInput
                      ariaLabel={t('category')}
                      value={section.name}
                      onChange={(name) => updateSection(section.key, { name })}
                      compact
                      className='min-w-48 flex-1'
                    />
                    <Select
                      value={section.catalogTypeId}
                      onValueChange={(catalogTypeId) =>
                        updateSection(section.key, { catalogTypeId })
                      }
                    >
                      <SelectTrigger
                        className='h-8 w-52'
                        aria-label={t('category')}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW_CATEGORY}>
                          {t('newCategoryFromScan')}
                        </SelectItem>
                        {categories.map((category) => (
                          <SelectItem
                            key={String(category.id)}
                            value={String(category.id)}
                          >
                            {localized(category.name)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='divide-y'>
                    {section.items.map((item) => (
                      <div
                        key={item.key}
                        className='grid grid-cols-[auto_1fr_6rem] items-start gap-2 p-3'
                      >
                        <Checkbox
                          className='mt-2'
                          aria-label={t('includeLine')}
                          checked={item.include}
                          onCheckedChange={(checked) =>
                            updateItem(item.key, { include: checked === true })
                          }
                        />
                        <div className='min-w-0 space-y-1.5'>
                          <LocalizedInput
                            ariaLabel={t('name')}
                            value={item.name}
                            onChange={(name) => updateItem(item.key, { name })}
                            compact
                          />
                          {(hasText(item.description.en) ||
                            hasText(item.description.ar)) && (
                            <LocalizedInput
                              ariaLabel={t('description')}
                              value={item.description}
                              onChange={(description) =>
                                updateItem(item.key, { description })
                              }
                              compact
                            />
                          )}
                          <div className='flex flex-wrap items-center gap-2'>
                            <p
                              className='text-muted-foreground min-w-0 truncate text-xs'
                              dir='auto'
                            >
                              {t('onThePhoto', { text: item.rawText })}
                            </p>
                            {item.existingItemId != null && (
                              <Badge variant='outline' className='shrink-0'>
                                {t('alreadyOnMenu')}
                              </Badge>
                            )}
                            {item.createdId != null && (
                              <Badge variant='secondary' className='shrink-0'>
                                {t('created')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Input
                          type='number'
                          step='0.5'
                          min='0'
                          aria-label={t('price')}
                          className='h-8 tabular-nums'
                          value={item.price}
                          onChange={(e) =>
                            updateItem(item.key, { price: e.target.value })
                          }
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </LocalizedFields>

        <SheetFooter className='mt-auto flex-row items-center border-t'>
          <span className='text-muted-foreground me-auto text-sm'>
            {creating
              ? t('creatingItems', {
                  done: creating.done,
                  total: creating.total,
                })
              : t('itemsSelected', { count })}
          </span>
          <Button
            type='button'
            variant='outline'
            disabled={!!creating}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button type='button' disabled={!!creating} onClick={confirm}>
            {creating && <Spinner className='me-2' />}
            {t('createScannedItems', { count })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
