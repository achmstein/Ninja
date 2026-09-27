import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, Minus, Plus, UtensilsCrossed } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { blurSwap, springSoft } from '@/lib/motion'
import { lineKey, useCart } from '@/lib/cart'
import { Odometer } from './odometer'
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
  jump,
  onSection,
  list,
  onScroller,
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
  /** A category to scroll to (its index among the categories), asked for by the jump bar; `n` tells two asks apart */
  jump: { index: number; n: number } | null
  /** The category in view changed, as the jump bar lights it */
  onSection: (index: number) => void
  /** The café's own menu (no deck behind it): a row per dish, a photo grid, compact text rows, or magazine cards */
  list?: MenuList
  /** Its scrolling box, handed up while it is on screen, so the chrome around it can follow its scroll */
  onScroller?: (el: HTMLDivElement | null) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const onScrollerRef = useRef(onScroller)
  useLayoutEffect(() => {
    const hand = onScrollerRef.current
    hand?.(scroller.current)
    return () => hand?.(null)
  }, [])
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

  // Which category is in view: the last one whose heading has reached the bar. While a jump
  // scrolls there, the bar keeps the one asked for, rather than lighting each one passed
  const sections = useRef<Array<HTMLElement | null>>([])
  const shown = useRef(-1)
  const jumping = useRef(false)
  const spy = () => {
    const el = scroller.current
    if (!el || jumping.current) return
    const line = el.scrollTop + DECK_TOP + 24
    let index = 0
    sections.current.forEach((section, i) => {
      if (section && section.offsetTop <= line) index = i
    })
    // At the very end the last one is in view, however short it is
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) index = categories.length - 1
    if (index !== shown.current) {
      shown.current = index
      onSection(index)
    }
  }
  useLayoutEffect(spy)
  // The jump reads these as they are when its scroll ends, not as they were when it began
  const spyRef = useRef(spy)
  const onSectionRef = useRef(onSection)
  useLayoutEffect(() => {
    spyRef.current = spy
    onSectionRef.current = onSection
  })

  useEffect(() => {
    const el = scroller.current
    const section = jump ? sections.current[jump.index] : null
    if (!el || !section) return
    // The one asked for lights at once, and stays lit while the scroll runs past the others
    jumping.current = true
    shown.current = jump!.index
    onSectionRef.current(jump!.index)
    el.scrollTo({ top: Math.max(0, section.offsetTop - DECK_TOP + 4), behavior: 'smooth' })
    const done = () => {
      if (!jumping.current) return
      jumping.current = false
      // Where it came to rest (a short last category cannot reach the top) is what the bar says then
      spyRef.current()
    }
    // Let go once the scroll settles (scrollend where there is one, a timer where there is not)
    el.addEventListener('scrollend', done, { once: true })
    const timer = window.setTimeout(done, 900)
    return () => {
      el.removeEventListener('scrollend', done)
      window.clearTimeout(timer)
    }
  }, [jump])

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
      onScroll={spy}
      className='no-scrollbar h-full overflow-y-auto overscroll-y-contain px-4 pb-6 [touch-action:pan-y]'
      style={{ paddingTop: DECK_TOP }}
    >
      {categories.map((col, index) => (
        <section
          key={col.id}
          ref={(el) => {
            sections.current[index] = el
          }}
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
          {list ? (
            <div className={LIST_CLASS[list]}>
              {col.items.map((item) => {
                const Dish = LIST_DISH[list]
                return (
                  <Dish
                    key={String(item.id)}
                    scroller={scroller}
                    item={item}
                    opening={Number(item.id) === openingId}
                    landing={Number(item.id) === landingId}
                    onOpen={open}
                    onQuickAdd={onQuickAdd}
                  />
                )
              })}
            </div>
          ) : (
          <div className='grid grid-cols-3 gap-2.5'>
            {col.items.map((item) => (
              <Tile
                key={String(item.id)}
                item={item}
                shared={sharedIds.has(Number(item.id))}
                opening={Number(item.id) === openingId}
                landing={Number(item.id) === landingId}
                onOpen={open}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
          )}
        </section>
      ))}
    </motion.div>
  )
}

function Tile({
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

/**
 * A dish in the classic menu: its photo, its name and a line of what it is,
 * its price, and a round + at the end. The row opens the dish's options
 * grown out of its photo, as a tile does; the + puts a dish that needs no
 * choosing straight in the tray (and opens one that does), and a held press
 * on the row does the same as on a tile.
 */
type DishProps = {
  /** The list's scroller: a dish rises in as it scrolls into it */
  scroller: React.RefObject<HTMLDivElement | null>
  item: CatalogItemDto
  opening: boolean
  landing: boolean
  onOpen: (item: CatalogItemDto) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
}

/** The menu styles a café may choose instead of the deck (the brand's menu item part) */
export type MenuList = 'row' | 'card' | 'compact' | 'hero'

/** Each rises into place the first time it scrolls into view, as the deck's cards arrive */
const rise = (scroller: DishProps['scroller']) =>
  ({
    initial: { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, root: scroller, margin: '0px 0px -8% 0px' },
    transition: springSoft,
  }) as const

/** What every dish of a list needs: its photo (or the plate), the press, the morph into its options */
function useDish({
  item,
  opening,
  onOpen,
  onQuickAdd,
  photo,
}: Pick<DishProps, 'item' | 'opening' | 'onOpen' | 'onQuickAdd'> & { photo: React.RefObject<HTMLElement | null> }) {
  const [failed, setFailed] = useState(false)
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item),
    onLongPress: () => onQuickAdd(item, photo.current),
  })
  return {
    pressing,
    handlers,
    hasPhoto: !!item.pictureUri && !failed,
    fail: () => setFailed(true),
    soldOut: item.isAvailable === false,
    onOffer: !!item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0),
    quick: canQuickAdd(item),
    // Only the one being opened carries the layout ids its options grow out of
    morph: opening,
  }
}

/** The photo box of a list's dish: the photo, or the plate on the café's colour, morphing into the options when opened */
function DishPhotoBox({
  item,
  dish,
  photoRef,
  radius,
  className,
  children,
}: {
  item: CatalogItemDto
  dish: ReturnType<typeof useDish>
  photoRef: React.RefObject<HTMLDivElement | null>
  radius: number
  className?: string
  children?: React.ReactNode
}) {
  return (
    <motion.div
      ref={photoRef}
      layoutId={dish.morph ? `card-${item.id}` : undefined}
      style={{ borderRadius: radius }}
      className={cn(
        'relative shrink-0 overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
        !dish.hasPhoto && TONE_CLASS.primary,
        dish.soldOut && 'grayscale',
        dish.pressing && 'scale-[0.96]',
        className
      )}
    >
      {dish.hasPhoto ? (
        <motion.div layoutId={dish.morph ? `photo-${item.id}` : undefined} className='bg-muted absolute inset-0'>
          <img src={itemPictureUrl(item.id)} alt='' loading='lazy' decoding='async' draggable={false} onError={dish.fail} className='size-full object-cover' />
        </motion.div>
      ) : (
        <motion.div layoutId={dish.morph ? `photo-${item.id}` : undefined} className='absolute inset-0 grid place-items-center'>
          <UtensilsCrossed className='size-1/3 max-w-12 opacity-40' />
        </motion.div>
      )}
      {children}
    </motion.div>
  )
}

/** The price, and the struck-out one under an offer */
function DishPrice({ item, onOffer, className }: { item: CatalogItemDto; onOffer: boolean; className?: string }) {
  const price = usePrice()
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className='bg-muted rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
      {onOffer && <span className='text-muted-foreground text-xs font-medium tabular-nums line-through'>{price(item.price)}</span>}
    </span>
  )
}

/** Photo grid: two big photo tiles a row, the name and price under each, the button on the photo's corner */
function PhotoTile({ scroller, item, opening, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, opening, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex min-w-0 flex-col gap-2', dish.soldOut && 'opacity-50')}>
      <div className='relative'>
        <button type='button' {...dish.handlers} className='block w-full select-none [-webkit-touch-callout:none]'>
          <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={24} className='aspect-[4/5] w-full' />
        </button>
        {!dish.soldOut && (
          <span className='absolute end-2 bottom-2'>
            <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />
          </span>
        )}
      </div>
      <button type='button' onClick={() => onOpen(item)} className='flex flex-col items-start gap-1.5 px-1 text-start'>
        <span className='heading line-clamp-2 text-[calc(1rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</span>
        <DishPrice item={item} onOffer={dish.onOffer} />
      </button>
    </motion.div>
  )
}

/** Compact: the name, a line of what it is, the price, the button; no photo, many to a screen */
function CompactRow({ scroller, item, opening, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  // What the dish flies to the tray from: the round button, a small circle, not the wide row
  const photo = useRef<HTMLSpanElement>(null)
  const dish = useDish({ item, opening, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('flex items-center gap-3 py-3', dish.soldOut && 'opacity-50')}>
      {/* The whole row is what grows into the options */}
      <motion.button
        type='button'
        layoutId={dish.morph ? `card-${item.id}` : undefined}
        style={{ borderRadius: 16 }}
        {...dish.handlers}
        className={cn('flex min-w-0 flex-1 flex-col text-start transition-transform duration-200 select-none [-webkit-touch-callout:none]', dish.pressing && 'scale-[0.98]')}
      >
        <span className='flex items-baseline justify-between gap-3'>
          <span className='text-[15px] leading-snug font-semibold'>{localized(item.name)}</span>
          <span className='shrink-0 text-[15px] font-bold tabular-nums'>
            {dish.onOffer && <span className='text-muted-foreground me-1.5 text-xs font-medium line-through'>{price(item.price)}</span>}
            {price(dish.onOffer ? item.offerPrice : item.price)}
          </span>
        </span>
        {item.description && <span className='text-muted-foreground line-clamp-1 text-[13px]'>{localized(item.description)}</span>}
      </motion.button>
      {!dish.soldOut && (
        <span ref={photo} className='shrink-0 rounded-full'>
          <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />
        </span>
      )}
    </motion.div>
  )
}

/** Magazine: one wide photo a dish, the name and price set on it under a shade, the button on its corner */
function HeroCard({ scroller, item, opening, onOpen, onQuickAdd }: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  const photo = useRef<HTMLDivElement>(null)
  const dish = useDish({ item, opening, onOpen, onQuickAdd, photo })
  return (
    <motion.div data-item={String(item.id)} {...rise(scroller)} className={cn('relative', dish.soldOut && 'opacity-50')}>
      <button type='button' {...dish.handlers} className='block w-full text-start select-none [-webkit-touch-callout:none]'>
        <DishPhotoBox item={item} dish={dish} photoRef={photo} radius={28} className='aspect-[16/11] w-full'>
          <span className='absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pe-20 pt-16 text-white'>
            <span className='heading text-[calc(1.5rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</span>
            {item.description && <span className='line-clamp-1 text-[13px] opacity-80'>{localized(item.description)}</span>}
            <span className='mt-1 text-[15px] font-bold tabular-nums'>
              {price(dish.onOffer ? item.offerPrice : item.price)}
              {dish.onOffer && <span className='ms-2 text-xs font-medium line-through opacity-70'>{price(item.price)}</span>}
            </span>
          </span>
        </DishPhotoBox>
      </button>
      {!dish.soldOut && (
        <span className='absolute end-4 bottom-4'>
          <RowAction item={item} quick={dish.quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />
        </span>
      )}
    </motion.div>
  )
}

function Row({
  scroller,
  item,
  opening,
  landing,
  onOpen,
  onQuickAdd,
}: DishProps) {
  const localized = useLocalized()
  const price = usePrice()
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed
  const soldOut = item.isAvailable === false
  const onOffer = item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const photo = useRef<HTMLDivElement>(null)
  const quick = canQuickAdd(item)
  const morph = opening && !landing
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item),
    onLongPress: () => onQuickAdd(item, photo.current),
  })

  return (
    // Each row rises into place the first time it scrolls into view, as the deck's cards arrive
    <motion.div
      data-item={String(item.id)}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, root: scroller, margin: '0px 0px -8% 0px' }}
      transition={springSoft}
      className={cn('flex items-center gap-4', soldOut && 'opacity-50')}
    >
      <button type='button' {...handlers} className='flex min-w-0 flex-1 items-center gap-4 text-start select-none [-webkit-touch-callout:none]'>
        <motion.div
          ref={photo}
          layoutId={morph ? `card-${item.id}` : undefined}
          // The row's photo stays put while a dish flies to the tray: the flight leaves from the options
          // sheet as often as from here, and a row is small enough that a copy lifting off reads fine
          style={{ borderRadius: 24 }}
          className={cn(
            'relative size-24 shrink-0 overflow-hidden transition-transform duration-200 ease-out motion-reduce:transition-none',
            !hasPhoto && TONE_CLASS.primary,
            soldOut && 'grayscale',
            pressing && 'scale-[0.94]'
          )}
        >
          {hasPhoto ? (
            <motion.div layoutId={morph ? `photo-${item.id}` : undefined} className='bg-muted absolute inset-0'>
              <img src={itemPictureUrl(item.id)} alt='' loading='lazy' decoding='async' draggable={false} onError={() => setFailed(true)} className='size-full object-cover' />
            </motion.div>
          ) : (
            // No photo (or one that would not load): the café's colour with a plate on it, as the classic menu always drew one
            <motion.div layoutId={morph ? `photo-${item.id}` : undefined} className='absolute inset-0 grid place-items-center'>
              <UtensilsCrossed className='size-8 opacity-40' />
            </motion.div>
          )}
        </motion.div>
        <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
          {/* The deck's card, laid on its side: the name in the heading's voice, the price its pill */}
          <span className='heading text-[calc(1.1rem*var(--heading-scale))] leading-tight'>{localized(item.name)}</span>
          {item.description && <span className='text-muted-foreground line-clamp-2 text-[13px] leading-snug'>{localized(item.description)}</span>}
          <span className='mt-1.5 flex items-center gap-2'>
            <span className='bg-muted rounded-full px-2.5 py-1 text-[13px] font-bold tabular-nums'>{price(onOffer ? item.offerPrice : item.price)}</span>
            {onOffer && <span className='text-muted-foreground text-xs font-medium tabular-nums line-through'>{price(item.price)}</span>}
          </span>
        </span>
      </button>
      {!soldOut && <RowAction item={item} quick={quick} onAdd={() => onQuickAdd(item, photo.current)} onOpen={() => onOpen(item)} />}
    </motion.div>
  )
}

/**
 * The end of a classic row. A dish that needs no choosing: a round plus,
 * which once the dish is in the tray opens into less, how many and more,
 * as the classic menu always had it (more flies another in; less takes the
 * newest one back out). A dish with something to choose: a chevron to its
 * options.
 */
function RowAction({ item, quick, onAdd, onOpen }: { item: CatalogItemDto; quick: boolean; onAdd: () => void; onOpen: () => void }) {
  const t = useT()
  const localized = useLocalized()
  const swap = blurSwap(useReducedMotion())
  const lines = useCart((s) => s.lines).filter((l) => l.productId === Number(item.id))
  const setQuantity = useCart((s) => s.setQuantity)
  const count = lines.reduce((sum, l) => sum + l.quantity, 0)
  const fill = 'bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgb(0_0_0/0.45)]'

  if (!quick) {
    return (
      <button
        type='button'
        aria-label={localized(item.name)}
        onClick={onOpen}
        className={cn('grid size-11 shrink-0 place-items-center rounded-full transition-transform active:scale-90 motion-reduce:transform-none', fill)}
      >
        <ChevronRight className='size-5 rtl:rotate-180' strokeWidth={2.5} />
      </button>
    )
  }

  const less = () => {
    const newest = lines.at(-1)
    if (newest) setQuantity(lineKey(newest), newest.quantity - 1)
  }
  return (
    <AnimatePresence mode='popLayout' initial={false}>
      {count === 0 ? (
        <motion.button
          key='add'
          type='button'
          aria-label={t('addToCart')}
          onClick={onAdd}
          {...swap}
          className={cn('grid size-11 shrink-0 place-items-center rounded-full active:scale-90 motion-reduce:transform-none', fill)}
        >
          <Plus className='size-5' strokeWidth={2.5} />
        </motion.button>
      ) : (
        <motion.div key='step' {...swap} className={cn('flex h-11 shrink-0 items-center gap-0.5 rounded-full px-1', fill)}>
          <button type='button' aria-label={t('ninjaLess')} onClick={less} className='grid size-9 place-items-center rounded-full active:bg-primary-foreground/15'>
            <Minus className='size-4' strokeWidth={2.5} />
          </button>
          <Odometer value={String(count)} className='min-w-5 text-center text-sm font-bold' />
          <button type='button' aria-label={t('ninjaMore')} onClick={onAdd} className='grid size-9 place-items-center rounded-full active:bg-primary-foreground/15'>
            <Plus className='size-4' strokeWidth={2.5} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const LIST_CLASS: Record<MenuList, string> = {
  row: 'flex flex-col gap-4',
  card: 'grid grid-cols-2 gap-x-3 gap-y-5',
  compact: 'divide-border/60 flex flex-col divide-y',
  hero: 'flex flex-col gap-4',
}

const LIST_DISH: Record<MenuList, (props: DishProps) => React.ReactNode> = {
  row: Row,
  card: PhotoTile,
  compact: CompactRow,
  hero: HeroCard,
}
