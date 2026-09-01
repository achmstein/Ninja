import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { Minus, Plus } from 'lucide-react'
import {
  type CatalogItemDto,
  type ItemCustomizationDto,
  type UserItemPreferenceDto,
} from '@/api/catalog'
import { getUserPreferenceOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { type CartCustomization } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'

export type Selections = Record<string, number[]>

export function defaultSelections(
  customizations: ItemCustomizationDto[] | undefined
): Selections {
  const result: Selections = {}
  for (const customization of customizations ?? []) {
    result[String(customization.id)] = (customization.options ?? [])
      .filter((o) => o.isDefault)
      .map((o) => Number(o.id))
  }
  return result
}

// The user's saved choices take precedence over item defaults (mobile parity);
// options that no longer exist are dropped.
export function preferenceSelections(
  customizations: ItemCustomizationDto[] | undefined,
  preference: UserItemPreferenceDto | undefined
): Selections {
  if (!preference?.selectedOptions?.length) {
    return defaultSelections(customizations)
  }
  const result = defaultSelections(customizations)
  for (const customization of customizations ?? []) {
    const saved = preference.selectedOptions
      .filter((o) => Number(o.customizationId) === Number(customization.id))
      .map((o) => Number(o.optionId))
      .filter((optionId) =>
        (customization.options ?? []).some((o) => Number(o.id) === optionId)
      )
    if (saved.length > 0) {
      result[String(customization.id)] = saved
    }
  }
  return result
}

export function selectionsToCustomizations(
  item: CatalogItemDto,
  selections: Selections
): CartCustomization[] {
  return (item.customizations ?? []).flatMap((customization) => {
    const selected = selections[String(customization.id)] ?? []
    return (customization.options ?? [])
      .filter((option) => selected.includes(Number(option.id)))
      .map((option) => ({
        customizationId: Number(customization.id),
        customizationNameEn: customization.name?.en ?? '',
        customizationNameAr: customization.name?.ar ?? undefined,
        optionId: Number(option.id),
        optionNameEn: option.name?.en ?? '',
        optionNameAr: option.name?.ar ?? undefined,
        priceAdjustment: Number(option.priceAdjustment ?? 0),
      }))
  })
}

export function effectiveBasePrice(item: CatalogItemDto): number {
  return Number(
    item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
      ? item.offerPrice
      : (item.price ?? 0)
  )
}

export function useSavedPreference(itemId: number) {
  const auth = useAuth()
  return useQuery({
    ...getUserPreferenceOptions({ path: { catalogItemId: itemId } }),
    enabled: auth.isAuthenticated && itemId > 0,
    retry: false,
  })
}

interface ItemCustomizeFormProps {
  item: CatalogItemDto
  onAdd: (
    customizations: CartCustomization[],
    quantity: number,
    instructions: string,
    unitPrice: number
  ) => void
  /**
   * Dialog layout: the options scroll in their own area and the CTA stays
   * pinned at the bottom. The default inline layout flows with the page.
   */
  pinnedCta?: boolean
}

/**
 * The customization form shared by the customize dialog and the item deep-link
 * page: option chips, quantity, special instructions, add-to-cart CTA.
 */
export function ItemCustomizeForm({
  item,
  onAdd,
  pinnedCta = false,
}: ItemCustomizeFormProps) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()

  // Saved choices arrive after the sheet opens, so rendering defaults in the
  // meantime makes the chips visibly jump when they land. Hold the options
  // until we know. isLoading rather than isPending is what tells a request in
  // flight apart from a query disabled for a signed-out customer, who has no
  // saved choices to wait for and should see the defaults straight away.
  const { data: preference, isLoading: loadingPreference } =
    useSavedPreference(Number(item.id))

  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState('')
  // null = untouched; saved preference / defaults apply until the user picks
  const [overrides, setOverrides] = useState<Selections | null>(null)

  const selections =
    overrides ?? preferenceSelections(item.customizations, preference)

  const chosen = selectionsToCustomizations(item, selections)
  const unitPrice =
    effectiveBasePrice(item) +
    chosen.reduce((sum, c) => sum + c.priceAdjustment, 0)

  const missingRequired = (item.customizations ?? []).some(
    (c) => c.isRequired && (selections[String(c.id)] ?? []).length === 0
  )

  const toggleOption = (
    customization: ItemCustomizationDto,
    optionId: number
  ) => {
    const key = String(customization.id)
    const current = selections[key] ?? []
    if (customization.allowMultiple) {
      setOverrides({
        ...selections,
        [key]: current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      })
      return
    }
    // Single-choice: tap again to clear only when the group is optional
    const next =
      current.includes(optionId) && !customization.isRequired ? [] : [optionId]
    setOverrides({ ...selections, [key]: next })
  }

  const body = (
    <>
      {(item.customizations ?? [])
        .slice()
        .sort(
          (a, b) => Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
        )
        .map((customization) => {
          const selected = selections[String(customization.id)] ?? []
          return (
            <div key={String(customization.id)} className='flex flex-col gap-2'>
              <div className='flex items-baseline gap-2'>
                <span className='text-sm font-semibold'>
                  {localized(customization.name)}
                </span>
                {customization.isRequired && (
                  <span className='text-destructive text-xs'>
                    {t('required')}
                  </span>
                )}
              </div>
              <div className='flex flex-wrap gap-2'>
                {loadingPreference &&
                  // Same shape as the chips they stand in for, so the sheet
                  // does not resize when the real ones arrive
                  (customization.options ?? []).map((option) => (
                    <Skeleton
                      key={String(option.id)}
                      className='h-8 w-20 rounded-full'
                    />
                  ))}
                {!loadingPreference &&
                  (customization.options ?? [])
                  .slice()
                  .sort(
                    (a, b) =>
                      Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
                  )
                  .map((option) => {
                    const optionId = Number(option.id)
                    const isSelected = selected.includes(optionId)
                    const adjustment = Number(option.priceAdjustment ?? 0)
                    return (
                      <Button
                        key={optionId}
                        size='sm'
                        variant={isSelected ? 'default' : 'outline'}
                        className='rounded-full'
                        onClick={() => toggleOption(customization, optionId)}
                      >
                        {localized(option.name)}
                        {adjustment > 0 && (
                          <span className='text-xs opacity-70'>
                            +{adjustment}
                          </span>
                        )}
                      </Button>
                    )
                  })}
              </div>
            </div>
          )
        })}

      <div className='flex items-center justify-between'>
        <span className='text-sm font-medium'>{t('quantity')}</span>
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='icon'
            className='rounded-full'
            aria-label='Decrease quantity'
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className='h-4 w-4' />
          </Button>
          <span className='w-6 text-center font-semibold tabular-nums'>
            {quantity}
          </span>
          <Button
            variant='outline'
            size='icon'
            className='rounded-full'
            aria-label='Increase quantity'
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <Textarea
        rows={2}
        placeholder={t('anySpecialRequestsOptional')}
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />
    </>
  )

  // Mobile-app parity: label at the start, price at the end (plus the
  // struck-through original price when the item is on offer)
  const originalUnitPrice =
    Number(item.price ?? 0) +
    chosen.reduce((sum, c) => sum + c.priceAdjustment, 0)

  const cta = (
    <Button
      size='lg'
      className='w-full justify-between rounded-full'
      disabled={!item.isAvailable || missingRequired || loadingPreference}
      onClick={() => onAdd(chosen, quantity, instructions.trim(), unitPrice)}
    >
      {item.isAvailable ? (
        <>
          <span className='font-bold'>{t('addToCart')}</span>
          <span className='flex items-center gap-1.5 font-bold'>
            {item.isOnOffer && originalUnitPrice > unitPrice && (
              <span className='text-xs font-normal opacity-70 line-through'>
                {price(originalUnitPrice * quantity)}
              </span>
            )}
            {price(unitPrice * quantity)}
          </span>
        </>
      ) : (
        <span className='mx-auto'>{t('unavailable')}</span>
      )}
    </Button>
  )

  if (!pinnedCta) {
    return (
      <div className='flex flex-col gap-4'>
        {body}
        {cta}
      </div>
    )
  }

  return (
    // Mobile: the dialog scrolls as one surface, so the body just flows and
    // the CTA sticks to the bottom of that scroll container (still pinned
    // when content is short — flex-1 pushes it down). Desktop: the body is
    // the scroll area and the CTA sits statically below it.
    <div className='flex flex-1 flex-col md:min-h-0'>
      <div className='flex flex-1 flex-col gap-4 p-4 md:overflow-y-auto'>
        {body}
      </div>
      <div className='bg-background sticky bottom-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:static md:pb-4'>
        {cta}
      </div>
    </div>
  )
}
