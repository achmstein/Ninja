import { Plus, Utensils } from 'lucide-react'
import { type CatalogItemDto } from '@/api/catalog'
import { useCart } from '@/lib/cart'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { ImageWithFallback } from '@/components/image-fallback'
import { itemPictureUrl } from './item-card'
import { cn } from '@/lib/utils'

interface OffersCarouselProps {
  items: CatalogItemDto[]
  onCustomize: (item: CatalogItemDto) => void
  orderingEnabled: boolean
  /** False for a style without photos: the cards are text */
  photos?: boolean
}

/** Horizontal rail of compact offer cards (mobile's Special Offers section). */
export function OffersCarousel({
  items,
  onCustomize,
  orderingEnabled,
  photos = true,
}: OffersCarouselProps) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const add = useCart((s) => s.add)

  if (items.length === 0) return null

  const handleAdd = (item: CatalogItemDto) => {
    if ((item.customizations?.length ?? 0) > 0) {
      onCustomize(item)
      return
    }
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: Number(item.offerPrice ?? item.price ?? 0),
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: 1,
      customizations: [],
    })
  }

  return (
    <section className='flex flex-col gap-2'>
      <h2 className='text-sm font-semibold'>{t('specialOffers')}</h2>
      <div className='no-scrollbar -mx-4 -my-3 flex snap-x gap-3 overflow-x-auto px-4 py-3'>
        {items.map((item) => (
          <div
            key={String(item.id)}
            className='surface text-card-foreground relative w-36 shrink-0 snap-start overflow-hidden rounded-xl'
          >
            <button
              type='button'
              className='block w-full text-start'
              onClick={() => orderingEnabled && handleAdd(item)}
            >
              {photos && (
                <ImageWithFallback
                  src={item.pictureUri ? itemPictureUrl(item.id) : null}
                  className='aspect-square w-full'
                  fallbackIcon={
                    <Utensils className='text-muted-foreground/40 h-8 w-8' />
                  }
                />
              )}
              <div className={cn('flex flex-col gap-0.5 p-2', !photos && 'pb-11')}>
                <span className='truncate text-sm font-semibold'>
                  {localized(item.name)}
                </span>
                <span className='text-sm font-bold text-green-600 dark:text-green-500'>
                  {price(item.offerPrice)}
                </span>
                <span className='text-muted-foreground text-xs line-through'>
                  {price(item.price)}
                </span>
              </div>
            </button>
            {orderingEnabled && (
              <Button
                size='icon'
                className='absolute end-2 bottom-2 size-7 rounded-(--radius-round)'
                aria-label={t('addToCart')}
                onClick={() => handleAdd(item)}
              >
                <Plus className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
