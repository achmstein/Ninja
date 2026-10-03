import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { type CatalogItemDto, type CatalogTypeDto } from '@/api/catalog'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { BranchOverrideSection } from './branch-override-section'
import { CustomizationsSection } from './customizations-section'
import { ItemDetailsForm } from './item-details-form'
import { PairingsSection } from './pairings-section'
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
 * the customizations customers pick from, what it suggests alongside it,
 * what a sale takes out of stock,
 * and this branch's own price. Only the tab being read is built, so opening
 * the sheet to change a price does not raise the recipe editor. A new item
 * has only details to give until it is saved, so the rest wait, disabled.
 * Each tab puts its own Save in the sheet's footer; Delete sits on the
 * details tab alone.
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

  // A different item starts on its details, not the tab last read
  const itemKey = item ? String(item.id) : 'new'
  const [tab, setTab] = useState('details')
  const [tabFor, setTabFor] = useState(itemKey)
  if (tabFor !== itemKey) {
    setTabFor(itemKey)
    setTab('details')
  }

  return (
    <EntitySheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onStateChange(null)
      }}
      // 2xl: the recipe editor needs an option set and a stock item name side by side
      className='sm:max-w-2xl'
      title={item ? localized(item.name) : t('addMenuItem')}
      tabs={{
        value: tab,
        onValueChange: setTab,
        items: [
          { value: 'details', label: t('details') },
          {
            value: 'customizations',
            label: t('customizations'),
            badge: item?.customizations?.length ?? 0,
            disabled: !item,
          },
          {
            value: 'pairings',
            label: t('goesWellWith'),
            badge: item?.pairedItemIds?.length ?? 0,
            disabled: !item,
          },
          {
            value: 'stock',
            label: t('stock'),
            disabled: !item,
            hidden: !features.inventory,
          },
          { value: 'branch', label: t('thisBranch'), disabled: !item },
        ],
      }}
    >
      <TabsContent value='details'>
        {item ? (
          <>
            <ItemDetailsForm
              key={String(item.id)}
              item={item}
              categories={categories}
              onSaved={() => {}}
            />
            <SheetActions side='start'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='text-destructive hover:text-destructive'
                onClick={() => onDelete(item)}
              >
                <Trash2 />
                {t('deleteItem')}
              </Button>
            </SheetActions>
          </>
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
          <TabsContent value='customizations'>
            <CustomizationsSection item={item} />
          </TabsContent>
          <TabsContent value='pairings'>
            <PairingsSection item={item} items={items} />
          </TabsContent>
          {features.inventory && (
            <TabsContent value='stock'>
              <StockRuleSection item={item} />
            </TabsContent>
          )}
          <TabsContent value='branch'>
            <BranchOverrideSection item={item} />
          </TabsContent>
        </>
      )}
    </EntitySheet>
  )
}
