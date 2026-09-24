import { Trash2 } from 'lucide-react'
import { type CatalogItemDto, type CatalogTypeDto } from '@/api/catalog'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
 * Everything about one menu item, a tab per question: its details and photo,
 * the customizations customers pick from, what a sale takes out of stock,
 * and this branch's own price. Only the tab being read is built, so opening
 * the sheet to change a price does not raise the recipe editor. A new item
 * has only details to give until it is saved, so the rest wait, disabled.
 */
export function ItemSheet({
  state,
  items,
  categories,
  onStateChange,
  onDelete,
}: ItemSheetProps) {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const item =
    state?.mode === 'edit'
      ? items.find((i) => toNumber(i.id) === state.itemId)
      : undefined
  const open = state?.mode === 'create' || !!item
  const customizations = item?.customizations?.length ?? 0

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onStateChange(null)
      }}
    >
      {/* 2xl: the recipe editor needs an option set and a stock item name side by side */}
      <SheetContent className='overflow-hidden sm:max-w-2xl'>
        <Tabs
          // A different item starts on its details, not the tab last read
          key={item ? String(item.id) : 'new'}
          defaultValue='details'
          className='flex min-h-0 flex-1 flex-col gap-0'
        >
          <SheetHeader>
            <SheetTitle className='pe-8'>
              {item ? localized(item.name) : t('addMenuItem')}
            </SheetTitle>
            <TabsList className='mt-1 w-full'>
              <TabsTrigger value='details'>{t('details')}</TabsTrigger>
              <TabsTrigger value='customizations' disabled={!item}>
                {t('customizations')}
                {customizations > 0 && (
                  <Badge
                    variant='secondary'
                    className='h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums'
                  >
                    {customizations}
                  </Badge>
                )}
              </TabsTrigger>
              {features.inventory && (
                <TabsTrigger value='stock' disabled={!item}>
                  {t('stock')}
                </TabsTrigger>
              )}
              <TabsTrigger value='branch' disabled={!item}>
                {t('thisBranch')}
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          <TabsContent value='details' className='min-h-0 overflow-y-auto p-4'>
            {item ? (
              <ItemDetailsForm
                key={String(item.id)}
                item={item}
                categories={categories}
                onSaved={() => {}}
              />
            ) : (
              <ItemDetailsForm
                key='new'
                item={null}
                categories={categories}
                defaultCategoryId={
                  state?.mode === 'create' ? state.categoryId : undefined
                }
                onSaved={(itemId) =>
                  onStateChange(itemId ? { mode: 'edit', itemId } : null)
                }
                onCancel={() => onStateChange(null)}
              />
            )}
          </TabsContent>

          {item && (
            <>
              <TabsContent
                value='customizations'
                className='min-h-0 overflow-y-auto p-4'
              >
                <CustomizationsSection item={item} />
              </TabsContent>
              {features.inventory && (
                <TabsContent
                  value='stock'
                  className='min-h-0 overflow-y-auto p-4'
                >
                  <StockRuleSection item={item} />
                </TabsContent>
              )}
              <TabsContent
                value='branch'
                className='min-h-0 overflow-y-auto p-4'
              >
                <BranchOverrideSection item={item} />
              </TabsContent>
            </>
          )}
        </Tabs>

        {item && (
          <div className='flex justify-end border-t p-4'>
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
        )}
      </SheetContent>
    </Sheet>
  )
}
