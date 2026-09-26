import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-picture'
import { PressRing } from './deck'
import { canQuickAdd, DECK_TOP, pinchIntent, TONE_CLASS, type DeckColumn } from './deck-model'
import { usePress } from './use-press'

/** A tile's corner; the card it came from is rounder, and the morph carries it across */
const TILE_RADIUS = 18

/**
 * The whole menu at a glance: the deck zoomed out. Each category is a short
 * heading over a grid of small tiles; the cards that were on screen morph
 * into their tiles, the rest fade in. The grid orders too, the way the deck
 * does: a tap opens the dish's options over the grid, grown out of its tile,
 * and a held press puts one straight in the tray. Pinching open, or the way
 * back in the bar, returns to the cards. The usuals are not repeated here:
 * each of them is a tile in its category.
 */
export function MenuGrid({
  columns,
  focusId,
  sharedIds,
  onOpen,
  onQuickAdd,
  onZoomIn,
  landingId,
}: {
  columns: DeckColumn[]
  /** The item the deck was on, scrolled into view on arrival */
  focusId: number | null
  /** The items whose card was on screen and so morph rather than appear */
  sharedIds: ReadonlySet<number>
  onOpen: (item: CatalogItemDto) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
  onZoomIn: () => void
  /** The dish whose photo is flying to the tray from its open card: its tile waits for it to land */
  landingId: number | null
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const categories = columns.filter((c) => c.kind === 'category')
  // The tile being opened takes its layout id a frame before its card opens, so the card grows
  // out of it; every other tile outside the deck's column has none, which keeps the zoom's first
  // frame cheap (each id is a box to measure)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const open = (item: CatalogItemDto) => {
    setOpeningId(Number(item.id))
    requestAnimationFrame(() => onOpen(item))
  }
  const focusColumn = categories.find((c) => c.items.some((i) => Number(i.id) === focusId))?.id

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
        <section
          key={col.id}
          className='mb-6'
          // Off-screen categories are not drawn until scrolled to; the one the deck was on always is,
          // so the grid can land on the dish it came from
          style={col.id === focusColumn ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 480px' }}
        >
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
                opening={Number(item.id) === openingId}
                landing={Number(item.id) === landingId}
                onOpen={open}
                onQuickAdd={onQuickAdd}
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
  opening,
  landing,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItemDto
  tone: DeckColumn['tone']
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
          !hasPhoto && TONE_CLASS[tone],
          soldOut && 'opacity-50 grayscale',
          pressing && 'scale-[0.95]'
        )}
      >
        {/* Held, a dish that needs no choosing fills a ring and drops into the tray */}
        {quick && (
          <span aria-hidden className={cn('absolute end-1.5 top-1.5 z-10 transition-opacity duration-200', pressing ? 'opacity-100' : 'opacity-0')}>
            <PressRing pressing={pressing} small />
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
            <span className='heading line-clamp-3 text-base leading-[1.05] break-words'>{localized(item.name)}</span>
          </motion.div>
        )}
      </motion.div>
      <span className='mt-1.5 truncate text-xs font-semibold'>{localized(item.name)}</span>
      <span className='text-muted-foreground text-xs tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
    </button>
  )
}
