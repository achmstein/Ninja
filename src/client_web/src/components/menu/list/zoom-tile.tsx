import { memo, useRef, useState } from 'react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { usePress } from '@/components/ninja/gestures/use-press'
import { PressRing } from '../deck/deck'
import { canQuickAdd, TONE_CLASS } from '../deck/deck-model'
import { OfferBadge } from '../offer'

/** A tile's corner; the card it came from is rounder, and the photo's flight carries it across */
const TILE_RADIUS = 18

/**
 * A dish on the whole menu (the deck zoomed out): a small photo tile, the
 * name and price under it. The photos of the cards that were on screen fly
 * into their tiles (found by `data-photo`); a tap opens the dish's options
 * grown out of its photo, a held press puts one straight in the tray.
 */
export const ZoomTile = memo(function ZoomTile({
  item,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItemDto
  onOpen: (item: CatalogItemDto, from: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
}) {
  const localized = useLocalized()
  const price = usePrice()
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed
  const soldOut = item.isAvailable === false
  const onOffer = item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const photo = useRef<HTMLDivElement>(null)
  const quick = canQuickAdd(item)
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item, photo.current),
    onLongPress: () => onQuickAdd(item, photo.current),
  })

  return (
    <button
      type='button'
      data-item={String(item.id)}
      {...handlers}
      className='flex min-w-0 flex-col text-start select-none [-webkit-touch-callout:none]'
    >
      <div
        ref={photo}
        data-photo={String(item.id)}
        style={{ borderRadius: TILE_RADIUS }}
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
          !hasPhoto && TONE_CLASS.primary,
          soldOut && 'opacity-50 grayscale',
          pressing && 'scale-[0.95]'
        )}
      >
        {onOffer && !soldOut && (
          <span className='absolute start-1.5 top-1.5 z-10'>
            <OfferBadge item={item} />
          </span>
        )}
        {/* Held, a dish that needs no choosing fills a ring and drops into the tray */}
        {quick && (
          <span aria-hidden className={cn('absolute end-1.5 top-1.5 z-10 transition-opacity duration-200', pressing ? 'opacity-100' : 'opacity-0')}>
            <PressRing pressing={pressing} blur={pressing} small />
          </span>
        )}
        {hasPhoto ? (
          <div className='bg-muted absolute inset-0'>
            <img
              src={itemPictureUrl(item, 640)}
              alt=''
              loading='lazy'
              decoding='async'
              draggable={false}
              onError={() => setFailed(true)}
              className='size-full object-cover'
            />
          </div>
        ) : (
          <div className='absolute inset-0 flex items-end p-2.5'>
            <span className='heading line-clamp-3 text-name leading-[1.05] break-words'>{localized(item.name)}</span>
          </div>
        )}
      </div>
      <span className='mt-1.5 truncate text-caption font-semibold'>{localized(item.name)}</span>
      <span className='text-caption tabular-nums'>
        <span className={cn(onOffer ? 'text-offer font-semibold' : 'text-muted-foreground')}>{price(onOffer ? item.offerPrice : item.price)}</span>
        {onOffer && <span className='text-muted-foreground ms-1.5 line-through'>{price(item.price)}</span>}
      </span>
    </button>
  )
})
