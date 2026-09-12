import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, Sparkles } from 'lucide-react'
import type {
  CatalogItemDto,
  ItemCustomizationDto,
  UserItemPreferenceDto,
} from '@/api/catalog/types.gen'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { itemPictureUrl } from './item-picture'
import type { SaleCustomization, SaleLine } from './cart'

type Selections = Record<string, number[]>

// Item defaults only — the cashier is signed in, not the customer, so the
// saved-preference lookup client_web does would fetch the wrong person's
// choices.
function defaultSelections(
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

// When a customer is attached, their saved choices take precedence over the
// item defaults (same overlay client_web applies for the customer themselves);
// options that no longer exist on the item are dropped.
function preferenceSelections(
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

// A sold-out option is never selected, whatever put it there: an item
// default, the customer's saved preference, or a pick made before the
// option ran out and the menu refetched.
function withoutOutOfStock(
  customizations: ItemCustomizationDto[] | undefined,
  selections: Selections
): Selections {
  const result: Selections = {}
  for (const customization of customizations ?? []) {
    const key = String(customization.id)
    result[key] = (selections[key] ?? []).filter((optionId) =>
      (customization.options ?? []).some(
        (o) => Number(o.id) === optionId && !o.isOutOfStock
      )
    )
  }
  return result
}

function selectionsToCustomizations(
  item: CatalogItemDto,
  selections: Selections
): SaleCustomization[] {
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

type CustomizeDialogProps = {
  item: CatalogItemDto | null
  /** The account this round is for, if one is attached; its saved choices
   *  pre-fill the form. Null for a walk-in — item defaults only. */
  customerId?: string | null
  onOpenChange: (open: boolean) => void
  onAdd: (line: SaleLine) => void
}

/**
 * Customization picker for an item pad tile: option chips (defaults
 * pre-selected), quantity, special instructions. Same selection semantics
 * as client_web's item form — required single-choice groups cannot be
 * cleared, optional ones toggle off, allowMultiple groups multi-select.
 */
export function CustomizeDialog({
  item,
  customerId,
  onOpenChange,
  onAdd,
}: CustomizeDialogProps) {
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        {item && (
          // Keyed on item + customer so switching either resets the form state
          <CustomizeForm
            key={`${item.id}:${customerId ?? ''}`}
            item={item}
            customerId={customerId}
            onAdd={onAdd}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CustomizeForm({
  item,
  customerId,
  onAdd,
}: {
  item: CatalogItemDto
  customerId?: string | null
  onAdd: (line: SaleLine) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  const [quantity, setQuantity] = useState(1)
  const [instructions, setInstructions] = useState('')
  const [rawSelections, setSelections] = useState<Selections>(() =>
    defaultSelections(item.customizations)
  )
  const selections = withoutOutOfStock(item.customizations, rawSelections)

  // The attached customer's saved choices for this item. A miss (404) just
  // leaves the defaults; the lookup never blocks adding the item.
  const { data: preference } = useQuery({
    queryKey: ['itemPreferenceForCustomer', customerId, item.id],
    queryFn: async () => {
      const response = await apiClient.get<UserItemPreferenceDto>(
        `/api/catalog/preferences/${item.id}/for/${customerId}`
      )
      return response.data
    },
    enabled: !!customerId,
    retry: false,
    staleTime: 60_000,
  })

  // Overlay the saved preference once it arrives, but only while the cashier
  // hasn't touched the options yet — never clobber a manual change.
  const touched = useRef(false)
  const applied = useRef(false)
  // Shown as a badge so the cashier knows the options came from this customer.
  const [prefApplied, setPrefApplied] = useState(false)
  useEffect(() => {
    if (applied.current || touched.current) return
    if (preference?.selectedOptions?.length) {
      setSelections(preferenceSelections(item.customizations, preference))
      applied.current = true
      setPrefApplied(true)
    }
  }, [preference, item.customizations])

  const chosen = selectionsToCustomizations(item, selections)
  const unitPrice =
    toNumber(item.effectivePrice ?? item.price) +
    chosen.reduce((sum, c) => sum + c.priceAdjustment, 0)

  const missingRequired = (item.customizations ?? []).some(
    (c) => c.isRequired && (selections[String(c.id)] ?? []).length === 0
  )

  const toggleOption = (
    customization: ItemCustomizationDto,
    optionId: number
  ) => {
    touched.current = true
    const key = String(customization.id)
    const current = selections[key] ?? []
    if (customization.allowMultiple) {
      setSelections({
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
    setSelections({ ...selections, [key]: next })
  }

  const add = () =>
    onAdd({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: unitPrice,
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity,
      specialInstructions: instructions.trim() || undefined,
      customizations: chosen,
    })

  return (
    <>
      <DialogHeader>
        <DialogTitle className='flex items-center gap-2 text-xl'>
          {localized(item.name)}
          {prefApplied && (
            <span
              title={t('preferenceLoaded')}
              aria-label={t('preferenceLoaded')}
              className='text-primary inline-flex'
            >
              <Sparkles className='size-4' />
            </span>
          )}
        </DialogTitle>
        {localized(item.description) && (
          <DialogDescription>{localized(item.description)}</DialogDescription>
        )}
      </DialogHeader>

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
                    const outOfStock = option.isOutOfStock ?? false
                    return (
                      <Button
                        key={optionId}
                        variant={isSelected ? 'default' : 'outline'}
                        className='h-11 rounded-full px-4 text-base'
                        disabled={outOfStock}
                        onClick={() => toggleOption(customization, optionId)}
                      >
                        {localized(option.name)}
                        {outOfStock ? (
                          <span className='text-muted-foreground text-xs'>
                            {t('outOfStock')}
                          </span>
                        ) : (
                          adjustment > 0 && (
                            <span className='text-xs opacity-70'>
                              +{adjustment}
                            </span>
                          )
                        )}
                      </Button>
                    )
                  })}
              </div>
            </div>
          )
        })}

      <div className='flex items-center justify-between'>
        <span className='text-sm font-semibold'>{t('quantity')}</span>
        <div className='flex items-center gap-3'>
          <Button
            variant='outline'
            size='icon'
            className='size-11 rounded-full'
            aria-label='Decrease quantity'
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            <Minus className='size-5' />
          </Button>
          <span className='w-8 text-center text-lg font-semibold tabular-nums'>
            {quantity}
          </span>
          <Button
            variant='outline'
            size='icon'
            className='size-11 rounded-full'
            aria-label='Increase quantity'
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus className='size-5' />
          </Button>
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label htmlFor='sale-special-instructions'>
          {t('specialInstructionsOptional')}
        </Label>
        <Input
          id='sale-special-instructions'
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          className='h-12 text-base'
          autoComplete='off'
        />
      </div>

      <Button
        size='lg'
        className='h-14 w-full justify-between px-5 text-lg'
        disabled={item.isAvailable === false || missingRequired}
        onClick={add}
      >
        {item.isAvailable === false ? (
          <span className='mx-auto'>{t('unavailable')}</span>
        ) : (
          <>
            <span>{t('addToOrder')}</span>
            <span className='tabular-nums'>{money(unitPrice * quantity)}</span>
          </>
        )}
      </Button>
    </>
  )
}
