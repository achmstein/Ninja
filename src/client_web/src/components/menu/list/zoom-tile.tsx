import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { usePress } from '@/components/ninja/gestures/use-press'
import { PressRing } from '../deck/deck'
import { canQuickAdd, TONE_CLASS } from '../deck/deck-model'

/** A tile's corner; the card it came from is rounder, and the morph carries it across */
const TILE_RADIUS = 18

/**
 * A dish on the whole menu (the deck zoomed out): a small photo tile, the
 * name and price under it. The cards that were on screen morph into their
 * tiles; a tap opens the dish's options grown out of it, a held press puts
 * one straight in the tray.
 */
export function ZoomTile({
  item,
  shared,
  opening,
  landing,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItemDto
  /** Its card was on screen in the deck: it morphs from it rather than appearing */
  shared: boolean
  /** Tapped: its card opens out of it and closes back into it */
  opening: boolean
  /** Its photo is in the air: the tile is out of sight until it lands, then fades back */
  landing: boolean
  onOpen: (item: CatalogItemDto) => void
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
  // Only a tile that morphs has layout ids; one whose photo is flying to the tray sits out
  const morph = (shared || opening) && !landing
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item),
    onLongPress: () => onQuickAdd(item, photo.current),
  })

  return (
    <button
      type='button'
      data-item={String(item.id)}
      {...handlers}
      className='flex min-w-0 flex-col text-start select-none [-webkit-touch-callout:none]'
    >
      <motion.div
        ref={photo}
        layoutId={morph ? `card-${item.id}` : undefined}
        initial={shared ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: landing ? 0 : 1, scale: 1 }}
        transition={landing ? { duration: 0 } : { duration: 0.28 }}
        style={{ borderRadius: TILE_RADIUS }}
        className={cn(
          'relative aspect-[4/5] w-full overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
          !hasPhoto && TONE_CLASS.primary,
          soldOut && 'opacity-50 grayscale',
          pressing && 'scale-[0.95]'
        )}
      >
        {/* Held, a dish that needs no choosing fills a ring and drops into the tray */}
        {quick && (
          <span aria-hidden className={cn('absolute end-1.5 top-1.5 z-10 transition-opacity duration-200', pressing ? 'opacity-100' : 'opacity-0')}>
            <PressRing pressing={pressing} blur={pressing} small />
          </span>
        )}
        {hasPhoto ? (
          <motion.div layoutId={morph ? `photo-${item.id}` : undefined} className='bg-muted absolute inset-0'>
            <img
              src={itemPictureUrl(item.id)}
              alt=''
              loading='lazy'
              decoding='async'
              draggable={false}
              onError={() => setFailed(true)}
              className='size-full object-cover'
            />
          </motion.div>
        ) : (
          <motion.div layoutId={morph ? `photo-${item.id}` : undefined} className='absolute inset-0 flex items-end p-2.5'>
            <span className='heading line-clamp-3 text-name leading-[1.05] break-words'>{localized(item.name)}</span>
          </motion.div>
        )}
      </motion.div>
      <span className='mt-1.5 truncate text-caption font-semibold'>{localized(item.name)}</span>
      <span className='text-muted-foreground text-caption tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
    </button>
  )
}
