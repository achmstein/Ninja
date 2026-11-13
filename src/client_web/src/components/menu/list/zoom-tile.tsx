import { memo, useRef, useState } from 'react'
import type { CatalogItemDto } from '@/api/catalog'
import { Plus } from 'lucide-react'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { usePress } from '@/components/ninja/gestures/use-press'
import { PressRing } from '../deck/deck'
import { TONE_CLASS } from '../deck/deck-model'
import { OfferBadge } from '../offer'
import { SoldOutBadge } from './item-parts'

/** A tile's corner; the card it came from is rounder, and the photo's flight carries it across */
const TILE_RADIUS = 18

/**
 * An item on the whole menu (the deck zoomed out): a small photo tile, the
 * name and price under it. The photos of the cards that were on screen fly
 * into their tiles (found by `data-photo`); a tap opens the item's options
 * grown out of its photo; its plus (or a held press) puts one straight in
 * the tray, or opens it when there is something to choose first.
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
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed
  const soldOut = item.isAvailable === false
  const onOffer = item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const photo = useRef<HTMLDivElement>(null)
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item, photo.current),
    onLongPress: () => onQuickAdd(item, photo.current),
  })

  return (
    // Not a button itself: it holds one (the plus), and a button may not sit in a button
    <div
      role='button'
      tabIndex={0}
      data-item={String(item.id)}
      {...handlers}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
        e.preventDefault()
        onOpen(item, photo.current)
      }}
      className='flex min-w-0 cursor-pointer flex-col text-start select-none [-webkit-touch-callout:none]'
    >
      <div
        ref={photo}
        data-photo={String(item.id)}
        style={{ borderRadius: TILE_RADIUS }}
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
          !hasPhoto && TONE_CLASS.primary,
          soldOut && 'opacity-75 grayscale',
          pressing && 'scale-[0.95]'
        )}
      >
        {soldOut && (
          <span className='absolute start-1.5 top-1.5 z-10'>
            <SoldOutBadge />
          </span>
        )}
        {onOffer && !soldOut && (
          <span className='absolute start-1.5 top-1.5 z-10'>
            <OfferBadge item={item} />
          </span>
        )}
        {/* Held, a ring fills: at the full ring the item drops into the tray, or opens when there is something to choose */}
        {!soldOut && (
          <span aria-hidden className={cn('absolute end-1.5 top-1.5 z-10 transition-opacity duration-150', pressing ? 'opacity-100' : 'opacity-0')}>
            <PressRing pressing={pressing} blur={pressing} small />
          </span>
        )}
        {!soldOut && (
          <button
            type='button'
            aria-label={t('ninjaAddItem', { name: localized(item.name) })}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onQuickAdd(item, photo.current)
            }}
            // Drawn small, reached like any button: 44 px round it
            className="absolute end-1.5 bottom-1.5 z-10 grid size-9 place-items-center rounded-full bg-white text-black shadow-[0_6px_14px_-6px_rgb(0_0_0/0.55)] transition-transform before:absolute before:-inset-1 before:content-[''] active:scale-90 motion-reduce:transform-none"
          >
            <Plus className='size-4' strokeWidth={2.75} />
          </button>
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
    </div>
  )
})
