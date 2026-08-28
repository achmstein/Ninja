import { ChevronRight, Heart, Minus, Plus, Star, Utensils } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type CatalogItemDto } from '@/api/catalog'
import { lineKey, useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/image-fallback'

export function itemPictureUrl(id: number | string | undefined): string {
  return `/api/catalog/items/${id}/pic`
}

export interface ItemRowProps {
  item: CatalogItemDto
  isFavorite: boolean
  canFavorite: boolean
  onToggleFavorite: (itemId: number) => void
  onCustomize: (item: CatalogItemDto) => void
  orderingEnabled: boolean
}

/**
 * Menu list row, mirroring the mobile app's tile: 64px picture with heart
 * overlay and offer ribbon, name/description/price, and an add button or
 * quantity stepper at the end.
 */
export function ItemRow({
  item,
  isFavorite,
  canFavorite,
  onToggleFavorite,
  onCustomize,
  orderingEnabled,
}: ItemRowProps) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const { lines, add, setQuantity } = useCart()

  const hasCustomizations = (item.customizations?.length ?? 0) > 0
  // The stepper only controls the plain line of this item
  const simpleLine = lines.find(
    (line) =>
      line.productId === Number(item.id) &&
      !line.bundleId &&
      line.customizations.length === 0 &&
      !line.specialInstructions
  )

  const onOffer =
    item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const effectivePrice = onOffer ? item.offerPrice : item.price

  const addSimple = () => {
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: Number(effectivePrice ?? 0),
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: 1,
      customizations: [],
    })
    toast.success(localized(item.name))
  }

  const handleOpen = () => {
    if (!orderingEnabled || !item.isAvailable) return
    if (hasCustomizations) {
      onCustomize(item)
    } else {
      addSimple()
    }
  }

  const canOrder = orderingEnabled && (item.isAvailable ?? true)

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b py-3 last:border-b-0',
        !item.isAvailable && 'opacity-50'
      )}
    >
      {/* Picture with heart overlay and offer ribbon */}
      <div className='relative shrink-0'>
        <button
          type='button'
          className='block'
          onClick={handleOpen}
          aria-label={localized(item.name)}
        >
          <ImageWithFallback
            src={item.pictureUri ? itemPictureUrl(item.id) : null}
            className='size-16 rounded-lg'
            fallbackIcon={
              <Utensils className='text-muted-foreground h-6 w-6' />
            }
          />
        </button>
        {canFavorite && (
          <button
            type='button'
            aria-label={t('favorites')}
            className='absolute start-1 top-1'
            onClick={() => onToggleFavorite(Number(item.id))}
          >
            <Heart
              className={cn(
                'h-4 w-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]',
                isFavorite ? 'fill-red-500 text-red-500' : 'text-white'
              )}
            />
          </button>
        )}
        {onOffer && (
          <span className='absolute inset-x-0 bottom-0 rounded-b-lg bg-green-600 py-0.5 text-center text-[10px] font-bold text-white'>
            {t('offer')}
          </span>
        )}
      </div>

      {/* Name / description / price */}
      <button
        type='button'
        className='min-w-0 flex-1 text-start'
        onClick={handleOpen}
      >
        <div className='flex items-center gap-1.5'>
          <span className='text-[15px] font-semibold'>
            {localized(item.name)}
          </span>
          {item.isPopular && (
            <Star className='h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400' />
          )}
        </div>
        {localized(item.description) && (
          <p className='text-muted-foreground line-clamp-2 text-[13px]'>
            {localized(item.description)}
          </p>
        )}
        <div
          className={cn(
            'mt-0.5 text-sm font-bold',
            onOffer && 'text-green-600 dark:text-green-500'
          )}
        >
          {price(effectivePrice)}
        </div>
        {onOffer && (
          <div className='text-muted-foreground text-xs line-through'>
            {price(item.price)}
          </div>
        )}
        {!item.isAvailable && (
          <span className='text-muted-foreground text-xs'>
            {t('unavailable')}
          </span>
        )}
      </button>

      {/* Add / stepper / fast order */}
      {canOrder &&
        (simpleLine ? (
          <div className='flex shrink-0 items-center gap-1.5'>
            <Button
              variant='outline'
              size='icon'
              className='size-8 rounded-full'
              aria-label='Decrease'
              onClick={() =>
                setQuantity(lineKey(simpleLine), simpleLine.quantity - 1)
              }
            >
              <Minus className='h-3.5 w-3.5' />
            </Button>
            <span className='w-4 text-center text-sm font-semibold tabular-nums'>
              {simpleLine.quantity}
            </span>
            <Button
              variant='outline'
              size='icon'
              className='size-8 rounded-full'
              aria-label='Increase'
              onClick={() =>
                setQuantity(lineKey(simpleLine), simpleLine.quantity + 1)
              }
            >
              <Plus className='h-3.5 w-3.5' />
            </Button>
          </div>
        ) : (
          // Same round button; chevron when the item opens the options sheet
          <Button
            size='icon'
            className='size-8 shrink-0 rounded-full'
            aria-label={hasCustomizations ? t('customizable') : t('addToCart')}
            onClick={handleOpen}
          >
            {hasCustomizations ? (
              <ChevronRight className='h-4 w-4 rtl:rotate-180' />
            ) : (
              <Plus className='h-4 w-4' />
            )}
          </Button>
        ))}
    </div>
  )
}
