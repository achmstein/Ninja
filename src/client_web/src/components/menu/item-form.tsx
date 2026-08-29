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

  const { data: preference } = useSavedPreference(Number(item.id))

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
                {(customization.options ?? [])
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

  const cta = (
    <Button
      size='lg'
      className='w-full rounded-full'
      disabled={!item.isAvailable || missingRequired}
      onClick={() => onAdd(chosen, quantity, instructions.trim(), unitPrice)}
    >
      {item.isAvailable
        ? `${t('addToCart')} · ${price(unitPrice * quantity)}`
        : t('unavailable')}
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
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex flex-1 flex-col gap-4 overflow-y-auto p-4'>
        {body}
      </div>
      <div className='border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4'>
        {cta}
      </div>
    </div>
  )
}
