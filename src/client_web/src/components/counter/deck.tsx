import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Plus, Repeat2 } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { itemPictureUrl } from '@/components/menu/item-card'
import type { PosterTone } from '@/components/menu/home/sections'
import { canQuickAdd, CARD_RADIUS, columnAt, DECK_TOP, pinchIntent, TONE_CLASS, type DeckColumn } from './deck-model'
import { LONG_PRESS_MS, usePress } from './use-press'

/** The gap between cards, px */
const GAP = 12

export type DeckPosition = { column: number; row: number }

/**
 * The deck: one column of big cards per category, side by side. Both
 * directions are the browser's own scroll snapping, so a swipe feels native
 * on any phone and costs nothing when the finger lifts; in Arabic the
 * columns run right to left because the page does.
 */
export function Deck({
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
  /** The row a column is scrolled to, told to the Counter so zooming out can find it */
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

  // Open where asked, before paint, so a tile growing back lands on its card
  useLayoutEffect(() => {
    const el = pager.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollLeft = (rtl ? -1 : 1) * start.column * el.clientWidth
    const col = columnEls.current[start.column]
    const card = col?.children[start.row] as HTMLElement | undefined
    if (col && card) col.scrollTop = card.offsetTop - DECK_TOP
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
      layoutScroll
      className='no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [touch-action:pan-x_pan-y]'
      onScroll={(e) => {
        if (steering.current) return
        const el = e.currentTarget
        const next = columnAt(el.scrollLeft, el.clientWidth, columns.length)
        if (next !== shown.current) {
          shown.current = next
          onColumnChange(next)
        }
      }}
    >
      {columns.map((col, c) => (
        <motion.div
          key={col.id}
          ref={(el) => {
            columnEls.current[c] = el
          }}
          layoutScroll
          role='group'
          aria-label={col.label}
          className='no-scrollbar h-full w-full shrink-0 snap-start snap-always snap-y snap-mandatory overflow-y-auto overscroll-y-contain px-4'
          style={{ paddingTop: DECK_TOP, scrollPaddingTop: DECK_TOP }}
          onScroll={(e) => {
            const el = e.currentTarget
            const first = el.firstElementChild as HTMLElement | null
            const step = (first?.offsetHeight ?? 0) + GAP
            if (step > GAP) onRowChange(c, Math.round(el.scrollTop / step))
          }}
        >
          {col.items.map((item) => (
            <DeckCard
              key={String(item.id)}
              item={item}
              tone={col.tone}
              // Only the column on screen morphs; the rest simply appear, which keeps a zoom cheap on a slow phone
              shared={c === column}
              usual={col.kind === 'usuals' && Number(item.id) === usualId}
              hint={Number(item.id) === holdHintId}
              onOpen={onOpen}
              onQuickAdd={onQuickAdd}
            />
          ))}
          <div aria-hidden className='h-10 shrink-0' />
        </motion.div>
      ))}
    </motion.div>
  )
}

function DeckCard({
  item,
  tone,
  shared,
  usual,
  hint,
  onOpen,
  onQuickAdd,
}: {
  item: CatalogItemDto
  tone: PosterTone
  shared: boolean
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
      className='mb-3 snap-start transition-transform duration-200 ease-out motion-reduce:transition-none'
      style={{ height: `calc(100% - ${DECK_TOP + 44}px)`, transform: pressing ? 'scale(0.97)' : undefined }}
    >
      <motion.article
        layoutId={shared ? `card-${item.id}` : undefined}
        style={{ borderRadius: CARD_RADIUS }}
        className='relative isolate h-full w-full cursor-pointer overflow-hidden select-none [-webkit-touch-callout:none]'
        {...handlers}
      >
        <CardFace item={item} tone={tone} usual={usual} photoRef={photo} layoutPhoto={shared} />
        {/* Holding a dish that needs no choosing: a ring fills round a plus, and at the full ring it is in the tray */}
        {quick && (
          <span
            aria-hidden
            className={cn(
              'absolute end-4 top-4 z-20 flex items-center gap-2 transition-opacity duration-200',
              pressing || hint ? 'opacity-100' : 'opacity-0'
            )}
          >
            {hint && <span className='rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm'>{t('counterHintHoldAdd')}</span>}
            <PressRing pressing={pressing} />
          </span>
        )}
      </motion.article>
    </div>
  )
}

const RING_R = 18
const RING_C = 2 * Math.PI * RING_R

function PressRing({ pressing }: { pressing: boolean }) {
  return (
    <span className='relative grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm'>
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
      <Plus className='size-5' strokeWidth={2.5} />
    </span>
  )
}

/** What a card shows: the photo under a scrim with the name, or, without a photo, the name set big on the category's colour. */
export function CardFace({
  item,
  tone,
  usual,
  photoRef,
  layoutPhoto,
}: {
  item: CatalogItemDto
  tone: PosterTone
  usual?: boolean
  photoRef?: MutableRefObject<HTMLDivElement | null>
  layoutPhoto: boolean
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
        <span className='flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-black'>
          <Repeat2 className='size-3.5' />
          {t('yourUsuals')}
        </span>
      )}
      {soldOut && <span className='rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white'>{t('unavailable')}</span>}
    </div>
  )

  const priceLine = (
    <div className='flex items-baseline gap-2 tabular-nums'>
      <span className='text-lg font-bold'>{price(onOffer ? item.offerPrice : item.price)}</span>
      {onOffer && <span className='text-sm line-through opacity-60'>{price(item.price)}</span>}
    </div>
  )

  if (!hasPhoto) {
    return (
      <motion.div
        ref={photoRef}
        layoutId={layoutPhoto ? `photo-${item.id}` : undefined}
        className={cn('absolute inset-0 flex flex-col justify-end p-6', TONE_CLASS[tone], soldOut && 'grayscale')}
      >
        {badges}
        <h2 className='heading text-[calc(2.75rem*var(--heading-scale))] leading-[0.95] break-words hyphens-auto'>{name}</h2>
        {description && <p className='mt-3 line-clamp-3 max-w-[28ch] text-sm opacity-80'>{description}</p>}
        <div className='mt-4'>{priceLine}</div>
      </motion.div>
    )
  }

  return (
    <>
      <motion.div
        ref={photoRef}
        layoutId={layoutPhoto ? `photo-${item.id}` : undefined}
        className={cn('bg-muted absolute inset-0 -z-10 overflow-hidden', soldOut && 'grayscale')}
      >
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
      <div aria-hidden className='absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/15 to-transparent' />
      {badges}
      <div className='absolute inset-x-0 bottom-0 p-6 text-white'>
        <h2 className='heading text-[calc(2rem*var(--heading-scale))] leading-[1.05] drop-shadow-[0_1px_8px_rgba(0,0,0,0.35)]'>{name}</h2>
        {description && <p className='mt-2 line-clamp-2 max-w-[34ch] text-sm text-white/80'>{description}</p>}
        <div className='mt-3'>{priceLine}</div>
      </div>
    </>
  )
}
