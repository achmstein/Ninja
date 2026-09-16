import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type CatalogItemDto } from '@/api/catalog'
import {
  getBranchOverridesOptions,
  removeBranchItemOverrideMutation,
  setBranchItemOverrideMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

type BranchOverrideSectionProps = {
  item: CatalogItemDto
}

/**
 * The active branch's own price and offer for this item, on top of the
 * chain-wide values in the details form. Blank means "same as the menu".
 * Availability at the branch is the switch on the menu row, not here.
 */
export function BranchOverrideSection({ item }: BranchOverrideSectionProps) {
  const queryClient = useQueryClient()
  const branchId = useBranchStore((s) => s.branchId)
  const { branches } = useAllowedBranches()
  const branch = branches.find((b) => toNumber(b.id) === branchId)
  const catalogItemId = toNumber(item.id)
  const base = item.base ?? item

  const overrides = useQuery({
    ...getBranchOverridesOptions({
      path: { branchId: branchId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: branchId != null,
  })
  const override = overrides.data?.find(
    (o) => toNumber(o.catalogItemId) === catalogItemId
  )

  // Keyed on the override so a refetch resets the fields to the saved state
  const key = `${override?.id ?? 'none'}-${override?.priceOverride ?? ''}-${override?.offerPriceOverride ?? ''}-${override?.isOnOfferOverride ?? ''}`

  if (!branch) return null
  if (overrides.isLoading) return <Skeleton className='h-9 w-64' />

  return (
    <OverrideForm
      key={key}
      branchId={toNumber(branch.id)}
      catalogItemId={catalogItemId}
      basePrice={toNumber(base.price)}
      isAvailable={override?.isAvailable ?? item.isAvailable ?? true}
      initial={{
        price:
          override?.priceOverride != null
            ? String(toNumber(override.priceOverride))
            : '',
        onOffer: override?.isOnOfferOverride ?? null,
        offerPrice:
          override?.offerPriceOverride != null
            ? String(toNumber(override.offerPriceOverride))
            : '',
      }}
      hasOverride={
        !!override &&
        (override.priceOverride != null ||
          override.offerPriceOverride != null ||
          override.isOnOfferOverride != null)
      }
      onChanged={() =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: [{ _id: 'getBranchOverrides' }],
          }),
          queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] }),
        ])
      }
    />
  )
}

type OverrideFormProps = {
  branchId: number
  catalogItemId: number
  basePrice: number
  /** The branch's manual availability, carried through untouched */
  isAvailable: boolean
  initial: { price: string; onOffer: boolean | null; offerPrice: string }
  hasOverride: boolean
  onChanged: () => Promise<unknown>
}

function OverrideForm({
  branchId,
  catalogItemId,
  basePrice,
  isAvailable,
  initial,
  hasOverride,
  onChanged,
}: OverrideFormProps) {
  const t = useT()
  const [price, setPrice] = useState(initial.price)
  const [onOffer, setOnOffer] = useState(initial.onOffer === true)
  const [offerPrice, setOfferPrice] = useState(initial.offerPrice)

  const setOverride = useMutation({
    ...setBranchItemOverrideMutation(),
    onSuccess: async () => {
      await onChanged()
      toast.success(t('branchPriceSaved'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })
  const clearOverride = useMutation({
    ...removeBranchItemOverrideMutation(),
    onSuccess: async () => {
      await onChanged()
      toast.success(t('branchPriceCleared'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })
  const isPending = setOverride.isPending || clearOverride.isPending

  const dirty =
    price !== initial.price ||
    onOffer !== (initial.onOffer === true) ||
    offerPrice !== initial.offerPrice

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedPrice = price.trim() === '' ? null : parseFloat(price)
    const parsedOffer = offerPrice.trim() === '' ? null : parseFloat(offerPrice)
    if (parsedPrice != null && !(parsedPrice >= 0)) return
    if (onOffer && !(parsedOffer != null && parsedOffer > 0)) {
      toast.error(t('offerPriceRequired'))
      return
    }
    setOverride.mutate({
      path: { branchId, itemId: catalogItemId },
      body: {
        isAvailable,
        priceOverride: parsedPrice,
        isOnOfferOverride: onOffer ? true : null,
        offerPriceOverride: onOffer ? parsedOffer : null,
      },
      query: { 'api-version': API_VERSION },
    })
  }

  return (
    <form onSubmit={save} className='space-y-3'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='override-price'>
            {t('priceAtBranch')} ({t('currency')})
          </Label>
          <Input
            id='override-price'
            type='number'
            step='0.01'
            min='0'
            placeholder={formatEgp(basePrice)}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className='space-y-2'>
          <div className='flex h-[14px] items-center justify-between'>
            <Label htmlFor='override-offer'>{t('offerAtBranch')}</Label>
            <Switch
              id='override-offer'
              checked={onOffer}
              onCheckedChange={setOnOffer}
            />
          </div>
          <Input
            type='number'
            step='0.01'
            min='0'
            disabled={!onOffer}
            aria-label={t('offerPrice')}
            placeholder={t('offerPrice')}
            value={offerPrice}
            onChange={(e) => setOfferPrice(e.target.value)}
          />
        </div>
      </div>
      <div className='flex justify-end gap-2'>
        {hasOverride && (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            className='text-muted-foreground'
            disabled={isPending}
            onClick={() =>
              clearOverride.mutate({
                path: { branchId, itemId: catalogItemId },
                query: { 'api-version': API_VERSION },
              })
            }
          >
            {t('clearOverride')}
          </Button>
        )}
        <Button type='submit' size='sm' disabled={!dirty || isPending}>
          {isPending && <Spinner className='me-2' />}
          {t('save')}
        </Button>
      </div>
    </form>
  )
}
