import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Plus, Repeat2 } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureSrcSet, itemPictureUrl } from '@/components/menu/item-picture'
import { canQuickAdd, CARD_RADIUS, columnAt, pinchIntent, TONE_CLASS, type DeckColumn } from './deck-model'

/** How much of the next card shows under the one in view, px */
const PEEK = 44

/**
 * Room at the top of a column, px: --deck-top, set by the Ninja style (the
 * top bar's room on the first card, a sliver past it; styles/index.css eases
 * it between the two)
 */
const topOf = (column: HTMLElement) => parseFloat(getComputedStyle(column).scrollPaddingTop) || 0
import { LONG_PRESS_MS, usePress } from '@/components/ninja/gestures/use-press'

/** How long the deck must rest on the next category's card before it moves on, ms (counted once the column has come to rest) */
const ADVANCE_AFTER = 60

/** How long a scroll must be still before it counts as resting on a card, ms (a snap's last frames included) */
const SETTLE_MS = 110

/**
 * The card a column rests on: the last one whose top has reached the room at
 * the column's top. Measured by the cards themselves, since the category's
 * poster at the head of a column is shorter than a dish's card
 */
function rowAt(column: HTMLElement, count: number): number {
  const line = column.scrollTop + topOf(column) + 8
  let row = 0
  Array.from(column.children).forEach((card, i) => {
    if (i < count && (card as HTMLElement).offsetTop <= line) row = i
  })
  return row
}

export type DeckPosition = { column: number; row: number }

/**
 * The deck: one column of big cards per category, side by side. Both
 * directions are the browser's own scroll snapping, so a swipe feels native
 * on any phone and costs nothing when the finger lifts; in Arabic the
 * columns run right to left because the page does. Memoised: the menu
 * screen renders as its chrome moves (past the first card, the tabs asked
 * back), and the deck has nothing to redraw for that.
 */
export const Deck = memo(function Deck({
  columns,
  column,
  onColumnChange,
  onRowChange,
  start,
  usualId,
  holdHintId,
  onOpen,
  onQuickAdd,
  onZoom,
}: {
  columns: DeckColumn[]
  column: number
  onColumnChange: (column: number) => void
  /** The row a column is scrolled to, told to the Ninja style so zooming out can find it */
  onRowChange: (column: number, row: number) => void
  /** Where the deck opens; read on mount only */
  start: DeckPosition
  usualId: number | null
  /** The card that carries the one-time "hold to add" cue, if any */
  holdHintId: number | null
  onOpen: (item: CatalogItemDto, photo: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
  onZoom: (direction: 'out' | 'in') => void
}) {
  const reduced = useReducedMotion()
  const pager = useRef<HTMLDivElement>(null)
  const columnEls = useRef<Array<HTMLDivElement | null>>([])
  // While the pager is being moved by a tab, its own scroll events are not the customer's
  const steering = useRef(false)
  const shown = useRef(start.column)

  // The cards keep the same two handlers from render to render, so the menu re-rendering (a tray
  // line, a timer, the chrome) passes them by: a card that renders re-measures every shared
  // layout on the page, which on a phone is a dropped frame per card
  const handlers = useRef({ onOpen, onQuickAdd })
  useLayoutEffect(() => {
    handlers.current = { onOpen, onQuickAdd }
  })
  const open = useCallback((item: CatalogItemDto, photo: HTMLElement | null) => handlers.current.onOpen(item, photo), [])
  const quickAdd = useCallback((item: CatalogItemDto, photo: HTMLElement | null) => handlers.current.onQuickAdd(item, photo), [])

  // Open where asked, before paint, so a tile growing back lands on its card
  useLayoutEffect(() => {
    const el = pager.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollLeft = (rtl ? -1 : 1) * start.column * el.clientWidth
    const col = columnEls.current[start.column]
    const card = col?.children[start.row] as HTMLElement | undefined
    if (col && card) col.scrollTop = card.offsetTop - topOf(col)
    onRowChange(start.column, start.row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A tab picked: glide there, and ignore the scroll that makes
  useEffect(() => {
    const el = pager.current
    if (!el || shown.current === column) return
    shown.current = column
    steering.current = true
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollTo({ left: (rtl ? -1 : 1) * column * el.clientWidth, behavior: reduced ? 'auto' : 'smooth' })
    const done = () => {
      steering.current = false
    }
    el.addEventListener('scrollend', done, { once: true })
    const fallback = window.setTimeout(done, 700)
    return () => {
      el.removeEventListener('scrollend', done)
      window.clearTimeout(fallback)
    }
  }, [column, reduced])

  // Resting on a column's last card, the "up next" one, moves on to the next
  // category the way a sideways swipe does; the column left behind goes back
  // to its last dish, so coming back lands on a dish rather than the way on
  // One timer of each kind for the whole deck, all cleared on the way out: nothing is read or told
  // while a swipe is still moving, only once it has come to rest
  const advanceTimer = useRef<number | null>(null)
  const rewindTimer = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)
  const pagerTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      for (const timer of [advanceTimer, rewindTimer, settleTimer, pagerTimer]) {
        if (timer.current !== null) window.clearTimeout(timer.current)
      }
    },
    []
  )
  const watchForNext = (c: number, el: HTMLElement) => {
    // The card is shorter than a dish, so the column cannot bring it to the
    // top: reaching the end of the column is resting on it
    const next = el.querySelector<HTMLElement>('[data-up-next]')
    if (!next || el.scrollTop + el.clientHeight < el.scrollHeight - 4) return
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null
      const nextColumn = columnEls.current[c + 1]
      if (nextColumn) nextColumn.scrollTop = 0
      onColumnChange(c + 1)
      rewindTimer.current = window.setTimeout(() => {
        rewindTimer.current = null
        const last = next.previousElementSibling as HTMLElement | null
        if (last) el.scrollTop = last.offsetTop - topOf(el)
      }, 700)
    }, ADVANCE_AFTER)
  }

  // Two fingers closing zoom out to the whole menu
  useEffect(() => {
    const el = pager.current
    if (!el) return
    let startDistance = 0
    let done = false
    const distance = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      startDistance = distance(e.touches)
      done = false
    }
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || done || !startDistance) return
      const intent = pinchIntent(startDistance, distance(e.touches))
      if (intent === 'out') {
        done = true
        onZoom('out')
      }
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
    }
  }, [onZoom])

  return (
    <motion.div
      ref={pager}
      className='no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x_pan-y]'
      onScroll={(e) => {
        if (steering.current) return
        const el = e.currentTarget
        // The category is told once the sideways swipe has come to rest, as the row is: telling it half
        // way re-rendered the menu while the browser was still snapping
        if (pagerTimer.current !== null) window.clearTimeout(pagerTimer.current)
        pagerTimer.current = window.setTimeout(() => {
          pagerTimer.current = null
          const next = columnAt(el.scrollLeft, el.clientWidth, columns.length)
          if (next !== shown.current) {
            shown.current = next
            onColumnChange(next)
          }
        }, SETTLE_MS)
      }}
    >
      {columns.map((col, c) => (
        <motion.div
          key={col.id}
          ref={(el) => {
            columnEls.current[c] = el
          }}
          role='group'
          aria-label={col.label}
          className='no-scrollbar h-full w-full shrink-0 snap-start snap-always snap-y snap-mandatory overflow-y-auto overscroll-y-contain px-4'
          style={{ paddingTop: 'var(--deck-top)', scrollPaddingTop: 'var(--deck-top)' }}
          onScroll={(e) => {
            const el = e.currentTarget
            // The row is told once the swipe has come to rest on a card, not half way there: what it
            // sets off (the bar going up, the cards growing into its room) resizes the cards, and doing
            // that while the browser is still snapping to one made the move stutter and jump
            // Scrolling reads nothing and sets nothing; the timers only restart
            if (settleTimer.current !== null) window.clearTimeout(settleTimer.current)
            if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
            advanceTimer.current = null
            settleTimer.current = window.setTimeout(() => {
              settleTimer.current = null
              onRowChange(c, rowAt(el, col.items.length))
              if (c === shown.current) watchForNext(c, el)
            }, SETTLE_MS)
          }}
        >
          {col.items.map((item) => (
            <DeckCard
              key={String(item.id)}
              item={item}
              usual={col.kind === 'usuals' && Number(item.id) === usualId}
              hint={Number(item.id) === holdHintId}
              onOpen={open}
              onQuickAdd={quickAdd}
            />
          ))}
          {columns[c + 1] && <UpNext column={columns[c + 1]} onGo={() => onColumnChange(c + 1)} />}
          <div aria-hidden className='h-10 shrink-0' />
        </motion.div>
      ))}
    </motion.div>
  )
})

/**
 * The card after a category's last dish: the next category's name on its
 * colour and a few of its dishes, rising as it comes into view. Resting on
 * it, or tapping it, carries on into that category. The last category has
 * none, so the deck ends there with a plain stop.
 */
function UpNext({ column, onGo }: { column: DeckColumn; onGo: () => void }) {
  const t = useT()
  const reduced = useReducedMotion()
  const faces = column.items.filter((item) => item.pictureUri).slice(0, 3)
  return (
    <motion.button
      type='button'
      data-up-next
      onClick={onGo}
      initial={reduced ? false : { y: 40, opacity: 0.3, scale: 0.94 }}
      whileInView={{ y: 0, opacity: 1, scale: 1 }}
      viewport={{ amount: 0.25 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className={cn('mb-3 flex w-full shrink-0 snap-start flex-col justify-between p-6 text-start', TONE_CLASS[column.tone])}
      style={{ height: `calc((100% - var(--deck-top) - ${PEEK}px) * 0.5)`, borderRadius: CARD_RADIUS }}
    >
      <span className='text-note font-semibold opacity-70'>{t('ninjaUpNext')}</span>
      <span className='flex items-end justify-between gap-4'>
        <span className='heading min-w-0 text-[calc(2.25rem*var(--heading-scale))] leading-[1] break-words'>{column.label}</span>
        <span className='grid size-12 shrink-0 place-items-center rounded-full bg-black/15'>
          <ArrowRight className='size-6 rtl:rotate-180' />
        </span>
      </span>
      {faces.length > 0 && (
        <span className='flex -space-x-3 rtl:space-x-reverse'>
          {faces.map((item) => (
            <img
              key={String(item.id)}
              src={itemPictureUrl(item, 320)}
              alt=''
              loading='lazy'
              decoding='async'
              draggable={false}
              className='size-12 rounded-full object-cover ring-2 ring-current/20'
            />
          ))}
        </span>
      )}
    </motion.button>
  )
}

/**
 * One dish's card. Memoised: it renders only when something about it
 * changes (the one-time cue), never as the deck scrolls or the menu round it
 * renders. Its photo is what its sheet grows out of and what flies to its
 * tile when the deck zooms out (both find it by its `data-photo`).
 */
const DeckCard = memo(function DeckCard({
  item,
  usual,
  hint,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItemDto
  usual: boolean
  hint: boolean
  onOpen: (item: CatalogItemDto, photo: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
}) {
  const t = useT()
  const photo = useRef<HTMLDivElement>(null)
  const quick = canQuickAdd(item)
  const { pressing, handlers } = usePress({
    onTap: () => onOpen(item, photo.current),
    onLongPress: () => onQuickAdd(item, photo.current),
  })

  return (
    <div
      // A card off screen (the other categories, the ones further down) keeps its box but is not laid
      // out or painted inside: the bar going up resizes every card in the deck, and only the ones in
      // view should cost anything while it does
      className='mb-3 snap-start transition-transform duration-200 ease-out [content-visibility:auto] motion-reduce:transition-none'
      style={{ height: `calc(100% - var(--deck-top) - ${PEEK}px)`, transform: pressing ? 'scale(0.97)' : undefined }}
    >
      <article
        style={{ borderRadius: CARD_RADIUS }}
        className='relative isolate h-full w-full cursor-pointer overflow-hidden select-none [-webkit-touch-callout:none]'
        {...handlers}
      >
        <CardFace item={item} usual={usual} photoRef={photo} />
        {/* Holding a dish that needs no choosing: a ring fills round a plus, and at the full ring it is in the tray */}
        {quick && (
          <span
            aria-hidden
            className={cn(
              'absolute end-4 top-4 z-20 flex items-center gap-2 transition-opacity duration-200',
              pressing || hint ? 'opacity-100' : 'opacity-0'
            )}
          >
            {hint && <span className='rounded-full bg-black/55 px-3 py-1.5 text-caption font-semibold text-white backdrop-blur-sm'>{t('ninjaHintHoldAdd')}</span>}
            <PressRing pressing={pressing} blur={pressing || hint} />
          </span>
        )}
      </article>
    </div>
  )
})

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

/**
 * A ring that fills round a plus while a press is held, full when the long press lands. `blur`
 * off leaves the frosted backdrop out while the ring is hidden: a backdrop blur on every card of
 * the deck, even at no opacity, is a layer the phone keeps re-reading as the cards scroll under it
 */
export function PressRing({ pressing, small = false, blur = true }: { pressing: boolean; small?: boolean; blur?: boolean }) {
  return (
    <span className={cn('relative grid place-items-center rounded-full bg-black/45 text-white', blur && 'backdrop-blur-sm', small ? 'size-9' : 'size-11')}>
      <svg viewBox='0 0 44 44' className='absolute inset-0 size-full -rotate-90'>
        <circle
          cx='22'
          cy='22'
          r={RING_R}
          fill='none'
          stroke='currentColor'
          strokeWidth='3'
          strokeLinecap='round'
          strokeDasharray={RING_C}
          style={{
            strokeDashoffset: pressing ? 0 : RING_C,
            transition: pressing ? `stroke-dashoffset ${LONG_PRESS_MS}ms linear` : 'none',
          }}
        />
      </svg>
      <Plus className={small ? 'size-4' : 'size-5'} strokeWidth={2.5} />
    </span>
  )
}

/** What a card shows: the photo under a scrim with the name, or, without a photo, the name set big on the business's colour. */
export function CardFace({
  item,
  usual,
  photoRef,
}: {
  item: CatalogItemDto
  usual?: boolean
  photoRef?: MutableRefObject<HTMLDivElement | null>
}) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const [failed, setFailed] = useState(false)
  const hasPhoto = !!item.pictureUri && !failed
  const onOffer = item.isOnOffer && Number(item.offerPrice ?? 0) < Number(item.price ?? 0)
  const soldOut = item.isAvailable === false
  const name = localized(item.name)
  const description = localized(item.description)

  const badges = (
    <div className='absolute inset-x-4 top-4 z-10 flex flex-wrap gap-2'>
      {usual && (
        <span className='flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-caption font-semibold text-black'>
          <Repeat2 className='size-3.5' />
          {t('yourUsuals')}
        </span>
      )}
      {soldOut && <span className='rounded-full bg-black/70 px-3 py-1 text-caption font-semibold text-white'>{t('unavailable')}</span>}
    </div>
  )

  const priceLine = (
    <div className='flex items-baseline gap-2 tabular-nums'>
      <span className='text-lg font-bold'>{price(onOffer ? item.offerPrice : item.price)}</span>
      {onOffer && <span className='text-note line-through opacity-60'>{price(item.price)}</span>}
    </div>
  )

  if (!hasPhoto) {
    return (
      <div
        ref={photoRef}
        data-photo={String(item.id)}
        className={cn('absolute inset-0 flex flex-col justify-end p-6', TONE_CLASS.primary, soldOut && 'grayscale')}
      >
        {badges}
        <h2 className='heading text-[calc(2.75rem*var(--heading-scale))] leading-[0.95] break-words hyphens-auto'>{name}</h2>
        {description && <p className='mt-3 line-clamp-3 max-w-[28ch] text-note opacity-80'>{description}</p>}
        <div className='mt-4'>{priceLine}</div>
      </div>
    )
  }

  return (
    <>
      <div
        ref={photoRef}
        data-photo={String(item.id)}
        className={cn('bg-muted absolute inset-0 -z-10 overflow-hidden', soldOut && 'grayscale')}
      >
        <img
          src={itemPictureUrl(item, 640)}
          srcSet={itemPictureSrcSet(item)}
          sizes='100vw'
          alt=''
          loading='lazy'
          decoding='async'
          draggable={false}
          onError={() => setFailed(true)}
          className='size-full object-cover'
        />
      </div>
      <div aria-hidden className='absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent' />
      {badges}
      <div className='absolute inset-x-0 bottom-0 p-6 text-white'>
        <h2 className='heading text-[calc(2rem*var(--heading-scale))] leading-[1.05] [text-shadow:0_1px_8px_rgba(0,0,0,0.35)]'>{name}</h2>
        {description && <p className='mt-2 line-clamp-2 max-w-[34ch] text-note text-white/80'>{description}</p>}
        <div className='mt-3'>{priceLine}</div>
      </div>
    </>
  )
}
