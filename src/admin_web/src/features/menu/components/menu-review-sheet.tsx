import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, X } from 'lucide-react'
import { type CatalogTypeDto, type MenuProposal } from '@/api/catalog'
import { importMenuMutation } from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
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
import { Spinner } from '@/components/ui/spinner'
import { EntitySheet } from '@/components/entity-sheet'
import { LocalizedFields, LocalizedInput } from '@/components/localized-input'
import { hasText } from '@/features/assist/helpers'
import {
  isReviewCategoryReady,
  isReviewItemReady,
  NEW_CATEGORY,
  type ReviewCategory,
  type ReviewChoiceOption,
  type ReviewItem,
  reviewItemPrice,
  toImportRequest,
  toReviewCategories,
} from '../menu-scan'

type MenuReviewSheetProps = {
  proposal: MenuProposal
  categories: CatalogTypeDto[]
  onOpenChange: (open: boolean) => void
}

/**
 * What the assistant read off the menu's pages, section by section, for
 * checking before anything is created: fix a name or a price (or a size's),
 * send a section to an existing category or let it become a new one, untick
 * what is not wanted (what is already on the menu starts unticked).
 * Confirming saves it all in one import: all of it or none of it, so a
 * failure leaves the sheet open and a retry never makes anything twice.
 */
export function MenuReviewSheet({
  proposal,
  categories,
  onOpenChange,
}: MenuReviewSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const importMenu = useMutation(importMenuMutation())

  const [sections, setSections] = useState<ReviewCategory[]>(() =>
    toReviewCategories(proposal)
  )
  const creating = importMenu.isPending

  const updateSection = (key: number, patch: Partial<ReviewCategory>) =>
    setSections((prev) =>
      prev.map((section) =>
        section.key === key ? { ...section, ...patch } : section
      )
    )

  const updateOption = (
    itemKey: number,
    optionKey: number,
    patch: Partial<ReviewChoiceOption>
  ) =>
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: section.items.map((item) =>
          item.key === itemKey && item.choice
            ? {
                ...item,
                choice: {
                  ...item.choice,
                  options: item.choice.options.map((option) =>
                    option.key === optionKey ? { ...option, ...patch } : option
                  ),
                },
              }
            : item
        ),
      }))
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

    try {
      await importMenu.mutateAsync({
        body: toImportRequest(sections),
        query: { 'api-version': API_VERSION },
      })
    } catch {
      toast.error(t('failedToSaveItem'))
      return
    }

    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listCategories' }] })
    toast.success(t('menuScanCreated', { count }))
    onOpenChange(false)
  }

  return (
    <EntitySheet
      open
      onOpenChange={(open) => !creating && onOpenChange(open)}
      title={t('reviewMenuScan')}
      size='wide'
      footerNote={creating ? t('savingMenu') : t('itemsSelected', { count })}
      actions={
        <>
          <Button
            type='button'
            variant='outline'
            disabled={!!creating}
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button type='button' disabled={!!creating} onClick={confirm}>
            {creating && <Spinner />}
            {t('createScannedItems', { count })}
          </Button>
        </>
      }
    >
      <LocalizedFields>
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
                      </div>
                      {item.choice && (
                        <div className='space-y-1.5 rounded-md border p-2'>
                          <div className='flex items-center gap-2'>
                            <LocalizedInput
                              ariaLabel={t('menuChoice')}
                              value={item.choice.name}
                              onChange={(name) =>
                                updateItem(item.key, {
                                  choice: { ...item.choice!, name },
                                })
                              }
                              compact
                              className='flex-1'
                            />
                            <Button
                              type='button'
                              variant='ghost'
                              size='sm'
                              className='h-8 shrink-0'
                              onClick={() =>
                                updateItem(item.key, {
                                  choice: null,
                                  price: String(reviewItemPrice(item) ?? ''),
                                })
                              }
                            >
                              <X className='size-3.5' />
                              {t('removeChoice')}
                            </Button>
                          </div>
                          {item.choice.options.map((option) => (
                            <div
                              key={option.key}
                              className='grid grid-cols-[1fr_6rem] gap-2'
                            >
                              <LocalizedInput
                                ariaLabel={t('name')}
                                value={option.name}
                                onChange={(name) =>
                                  updateOption(item.key, option.key, {
                                    name,
                                  })
                                }
                                compact
                              />
                              <Input
                                type='number'
                                step='0.5'
                                min='0'
                                aria-label={t('price')}
                                className='h-8 tabular-nums'
                                value={option.price}
                                onChange={(e) =>
                                  updateOption(item.key, option.key, {
                                    price: e.target.value,
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* With sizes, the item costs the cheapest one */}
                    <Input
                      type='number'
                      step='0.5'
                      min='0'
                      aria-label={t('price')}
                      className='h-8 tabular-nums'
                      disabled={!!item.choice}
                      value={
                        item.choice
                          ? String(reviewItemPrice(item) ?? '')
                          : item.price
                      }
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
      </LocalizedFields>
    </EntitySheet>
  )
}
