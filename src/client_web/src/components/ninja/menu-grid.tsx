import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-card'
import { DECK_TOP, pinchIntent, TONE_CLASS, type DeckColumn } from './deck-model'

/** A tile's corner; the card it came from is rounder, and the morph carries it across */
const TILE_RADIUS = 18

/**
 * The whole menu at a glance: the deck zoomed out. Each category is a short
 * heading over a grid of small tiles; the cards that were on screen morph
 * into their tiles, the rest fade in. A tap grows a tile back into its card.
 * The usuals are not repeated here: each of them is a tile in its category.
 */
export function MenuGrid({
  columns,
  focusId,
  sharedIds,
  onPick,
  onZoomIn,
}: {
  columns: DeckColumn[]
  /** The item the deck was on, scrolled into view on arrival */
  focusId: number | null
  /** The items whose card was on screen and so morph rather than appear */
  sharedIds: ReadonlySet<number>
  onPick: (item: CatalogItemDto) => void
  onZoomIn: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const categories = columns.filter((c) => c.kind === 'category')

  // Arrive with the dish we were on in view, before the morph measures it
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || focusId == null) return
    const tile = el.querySelector<HTMLElement>(`[data-item='${focusId}']`)
    if (tile) el.scrollTop = Math.max(0, tile.offsetTop - el.clientHeight / 3)
  }, [focusId])

  // Two fingers opening grow back into the deck
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let startDistance = 0
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) startDistance = distance(e.touches)
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !startDistance) return
      if (pinchIntent(startDistance, distance(e.touches)) === 'in') {
        startDistance = 0
        onZoomIn()
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [onZoomIn])

  return (
    <motion.div
      ref={scroller}
      layoutScroll
      className='no-scrollbar h-full overflow-y-auto overscroll-y-contain px-4 pb-6 [touch-action:pan-y]'
      style={{ paddingTop: DECK_TOP }}
    >
      {categories.map((col) => (
        <section key={col.id} className='mb-6'>
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className='heading mb-2.5 text-[calc(1.05rem*var(--heading-scale))]'
          >
            {col.label}
          </motion.h2>
          <div className='grid grid-cols-3 gap-2.5'>
            {col.items.map((item) => (
              <Tile
                key={String(item.id)}
                item={item}
                tone={col.tone}
                shared={sharedIds.has(Number(item.id))}
                onPick={onPick}
              />
            ))}
          </div>
        </section>
      ))}
    </motion.div>
  )
}

function Tile({
  item,
  tone,
  shared,
  onPick,
}: {
  item: CatalogItemDto
  tone: DeckColumn['tone']
  shared: boolean
  onPick: (item: CatalogItemDto) => void
}) {
  const localized = useLocalized()
  const price = usePrice()
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed
  const soldOut = item.isAvailable === false
  const onOffer = item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)

  return (
    <button type='button' data-item={String(item.id)} onClick={() => onPick(item)} className='flex min-w-0 flex-col text-start'>
      <motion.div
        layoutId={`card-${item.id}`}
        initial={shared ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.28 }}
        style={{ borderRadius: TILE_RADIUS }}
        className={cn('relative aspect-[4/5] w-full overflow-hidden', !hasPhoto && TONE_CLASS[tone], soldOut && 'opacity-50 grayscale')}
      >
        {hasPhoto ? (
          <motion.div layoutId={`photo-${item.id}`} className='bg-muted absolute inset-0'>
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
          <motion.div layoutId={`photo-${item.id}`} className='absolute inset-0 flex items-end p-2.5'>
            <span className='heading line-clamp-3 text-base leading-[1.05] break-words'>{localized(item.name)}</span>
          </motion.div>
        )}
      </motion.div>
      <span className='mt-1.5 truncate text-xs font-semibold'>{localized(item.name)}</span>
      <span className='text-muted-foreground text-xs tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
    </button>
  )
}
