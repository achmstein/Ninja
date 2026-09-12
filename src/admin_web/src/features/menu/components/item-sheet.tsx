import { Trash2 } from 'lucide-react'
import { type CatalogItemDto, type CatalogTypeDto } from '@/api/catalog'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { BranchOverrideSection } from './branch-override-section'
import { CustomizationsSection } from './customizations-section'
import { ItemDetailsForm } from './item-details-form'
import { StockRuleSection } from './stock-rule-section'

export type ItemSheetState =
  | { mode: 'edit'; itemId: number }
  | { mode: 'create'; categoryId?: number }
  | null

type ItemSheetProps = {
  state: ItemSheetState
  /** The live list; the sheet reads its item from here so edits show at once */
  items: CatalogItemDto[]
  categories: CatalogTypeDto[]
  onStateChange: (state: ItemSheetState) => void
  onDelete: (item: CatalogItemDto) => void
}

/**
 * Everything about one menu item, in one place: details and photo, the
 * customizations customers pick from, what a sale takes out of stock, and
 * this branch's own price. A new item starts with details only and turns
 * into the full sheet once saved.
 */
export function ItemSheet({
  state,
  items,
  categories,
  onStateChange,
  onDelete,
}: ItemSheetProps) {
  const t = useT()
  const localized = useLocalized()
  const item =
    state?.mode === 'edit'
      ? items.find((i) => toNumber(i.id) === state.itemId)
      : undefined
  const open = state?.mode === 'create' || !!item

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onStateChange(null)
      }}
    >
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {item ? localized(item.name) : t('addMenuItem')}
          </SheetTitle>
          <SheetDescription>
            {item
              ? localized(item.catalogTypeName) || t('uncategorized')
              : t('addMenuItemDescription')}
          </SheetDescription>
        </SheetHeader>

        {state?.mode === 'create' && (
          <Section title={t('details')}>
            <ItemDetailsForm
              key='new'
              item={null}
              categories={categories}
              defaultCategoryId={state.categoryId}
              onSaved={(itemId) =>
                onStateChange(itemId ? { mode: 'edit', itemId } : null)
              }
              onCancel={() => onStateChange(null)}
            />
          </Section>
        )}

        {item && (
          <>
            <Section title={t('details')}>
              <ItemDetailsForm
                key={String(item.id)}
                item={item}
                categories={categories}
                onSaved={() => {}}
              />
            </Section>
            <Section
              title={t('customizations')}
              hint={t('customizationsSectionHint')}
            >
              <CustomizationsSection item={item} />
            </Section>
            <Section title={t('stock')} hint={t('stockRuleHint')}>
              <StockRuleSection item={item} />
            </Section>
            <Section title={t('thisBranch')}>
              <BranchOverrideSection item={item} />
            </Section>
            <div className='mt-auto flex justify-end border-t p-4'>
              <Button
                type='button'
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => onDelete(item)}
              >
                <Trash2 className='me-2 h-4 w-4' />
                {t('deleteItem')}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className='space-y-3 border-b p-4'>
      <div>
        <h3 className='text-sm font-semibold'>{title}</h3>
        {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
      </div>
      {children}
    </section>
  )
}
