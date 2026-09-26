import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, MotionConfig, useReducedMotion } from 'motion/react'
import { ArrowLeft, LayoutGrid, MoveVertical } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useIsCloudKitchen } from '@/lib/brand'
import { useBrandLayout } from '@/lib/brand-layout'
import { useCart } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { useOrderPill } from '@/lib/order-pill'
import { toast } from '@/lib/toast'
import { usePlaceOrder } from '@/lib/use-place-order'
import { cn } from '@/lib/utils'
import { SignInSheet } from '@/components/sign-in-options'
import { itemPictureUrl } from '@/components/menu/item-card'
import { usePageMark } from '@/components/menu/home/page-effects'
import { OrderingPausedNote } from '@/components/menu/home/shared'
import type { HomeProps } from '@/components/menu/home/use-menu'
import { DOCK_INSET } from './chrome'
import { CounterNav } from './counter-nav'
import { CounterTopBar } from './counter-top-bar'
import { Deck, type DeckPosition } from './deck'
import { buildDeck, canQuickAdd, DECK_TOP, pickUsual, positionOf, quickAddChoice, TONE_CLASS, type DeckColumn } from './deck-model'
import { FlightLayer, type Flight } from './flights'
import { HintBubble } from './hint-bubble'
import { LiquidTabs } from './liquid-tabs'
import { MenuGrid } from './menu-grid'
import { Tray } from './tray'
import { Tune, type TuneResult } from './tune'
import { useHint, useTimeout } from './use-hint'

type Tuning = { item: CatalogItemDto; tone: DeckColumn['tone'] }

/**
 * The Counter: ordering as one surface that never leaves the page. Dishes
 * are big cards in a deck (up and down within a category, sideways between
 * them); a card opens in place into its options; what is added flies into
 * the tray; and a held press sends the order through the same path the cart
 * page uses, after which the order pill at the top takes over. Pinch, or tap
 * the category again, to see the whole menu. The bar at the top is see-
 * through over the cards; the tray and the app's tabs are one dock below.
 * The gestures are each shown once, on a first visit.
 */
export function CounterHome({ menu }: HomeProps) {
  usePageMark('menu-counter')
  const t = useT()
  const localized = useLocalized()
  const reduced = useReducedMotion()
  const cloudKitchen = useIsCloudKitchen()
  // A café may keep the classic bars under the Counter: then the app's own tab bar sits under the dock
  const counterChrome = useBrandLayout().chrome === 'counter'
  const add = useCart((s) => s.add)

  const columns = useMemo(() => buildDeck(menu.sections), [menu.sections])
  const usual = pickUsual(columns)
  // The deck is keyed by its columns: the usuals arrive a moment after the menu, and the deck then opens on them
  const deckKey = columns.map((c) => c.id).join('|')

  const [activeId, setActiveId] = useState<string | null>(null)
  const [moved, setMoved] = useState<DeckPosition>({ column: 0, row: 0 })
  // Until the customer moves, the deck sits on its first column (the usuals once they land)
  const [touched, setTouched] = useState(false)
  const column = touched ? Math.max(0, columns.findIndex((c) => c.id === activeId)) : 0
  const start: DeckPosition = touched ? moved : { column: 0, row: 0 }
  const rows = useRef<Record<number, number>>({})
  const [activeRow, setActiveRow] = useState(0)

  const [mode, setMode] = useState<'deck' | 'grid'>('deck')
  const [gridFocus, setGridFocus] = useState<{ id: number | null; shared: Set<number> }>({ id: null, shared: new Set() })
  const [tuning, setTuning] = useState<Tuning | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [flights, setFlights] = useState<Flight[]>([])
  const [bump, setBump] = useState(0)
  const [signInOpen, setSignInOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const target = useRef<HTMLDivElement>(null)
  const flightId = useRef(0)
  const keepHoldingToast = useRef<string | null>(null)
  // When the guest last touched the page: a scroll only counts as their swipe
  // if they were touching it (a resize or the browser's bars re-snapping the
  // deck scrolls it too, and must not end the swipe cue)
  const lastInput = useRef(0)
  const noteInput = () => {
    lastInput.current = performance.now()
  }
  const byGuest = () => performance.now() - lastInput.current < 1500

  const order = usePlaceOrder({
    onPlaced: (finish) => {
      setExpanded(false)
      setAnnounce(t('orderPlacedSuccessfully'))
      // In one render the tray empties (the hold button goes) and the pill at
      // the top grows out of it, to follow the order from here
      useOrderPill.getState().follow()
      finish()
    },
  })

  const canOrder = menu.orderingEnabled
  const loading = menu.isLoading && columns.length === 0

  // First visit: each gesture shown once, one after another, while nothing else is going on
  const swipeHint = useHint('swipe')
  const zoomHint = useHint('zoom')
  const holdHint = useHint('holdAdd')
  const idle = !loading && columns.length > 0 && mode === 'deck' && !tuning && !expanded
  const current = swipeHint.pending ? swipeHint : zoomHint.pending ? zoomHint : holdHint.pending ? holdHint : null
  const activeItem = columns[column]?.items[activeRow]
  // "Hold to add" waits for a card a long press would add straight away
  const cueFits = current !== holdHint || (!!activeItem && canQuickAdd(activeItem))
  useTimeout(idle && cueFits && current != null && !current.showing, 1400, () => current?.show())
  useTimeout(!!current?.showing, 3800, () => current?.done())
  const holdHintId = holdHint.showing && activeItem && canQuickAdd(activeItem) ? Number(activeItem.id) : null

  const selectColumn = useCallback(
    (index: number) => {
      setTouched(true)
      setActiveId(columns[index]?.id ?? null)
      setActiveRow(rows.current[index] ?? 0)
      if (swipeHint.pending && byGuest()) swipeHint.done()
    },
    [columns, swipeHint]
  )

  const onRowChange = (c: number, row: number) => {
    rows.current[c] = row
    if (c !== column) return
    if (row !== activeRow) setActiveRow(row)
    if (row > 0 && swipeHint.pending && byGuest()) swipeHint.done()
  }

  const zoomOut = useCallback(() => {
    const col = columns[column]
    const row = rows.current[column] ?? 0
    setGridFocus({
      id: col?.items[row] ? Number(col.items[row].id) : null,
      shared: new Set((col?.items ?? []).map((i) => Number(i.id))),
    })
    setTuning(null)
    setMode('grid')
    if (zoomHint.pending) zoomHint.done()
  }, [columns, column, zoomHint])

  const zoomIn = useCallback(
    (item?: CatalogItemDto) => {
      const position = item ? positionOf(columns, item.id) : { column, row: rows.current[column] ?? 0 }
      if (position) {
        setTouched(true)
        setActiveId(columns[position.column]?.id ?? null)
        setMoved(position)
        setActiveRow(position.row)
      }
      setMode('deck')
    },
    [columns, column]
  )

  const onZoom = useCallback((direction: 'out' | 'in') => (direction === 'out' ? zoomOut() : zoomIn()), [zoomOut, zoomIn])

  /** A photo lifts off where it is and flies into the tray */
  const fly = (item: CatalogItemDto, from: HTMLElement | null, tone: DeckColumn['tone']) => {
    setAnnounce(t('counterAdded', { name: localized(item.name) }))
    const to = target.current?.getBoundingClientRect()
    const box = from?.getBoundingClientRect()
    if (reduced || !to || !box || box.width === 0) {
      setBump((b) => b + 1)
      return
    }
    const id = ++flightId.current
    setFlights((f) => [
      ...f,
      {
        id,
        from: { x: box.x, y: box.y, width: box.width, height: box.height },
        // The first thumbnail's slot
        to: { x: to.x, y: to.y, width: 44, height: 44 },
        src: item.pictureUri ? itemPictureUrl(item.id) : null,
        toneClass: TONE_CLASS[tone],
      },
    ])
  }

  const addLine = (item: CatalogItemDto, result: TuneResult) =>
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: result.unitPrice,
      pictureUrl: item.pictureUri ? itemPictureUrl(item.id) : undefined,
      quantity: result.quantity,
      specialInstructions: result.instructions || undefined,
      customizations: result.customizations,
    })

  const toneOf = (item: CatalogItemDto): DeckColumn['tone'] => {
    const position = positionOf(columns, item.id)
    return position ? columns[position.column].tone : 'primary'
  }

  const onQuickAdd = (item: CatalogItemDto, photo: HTMLElement | null) => {
    if (!canOrder) {
      toast.warning(t('orderingUnavailable'))
      return
    }
    if (item.isAvailable === false) {
      toast.warning(t('counterSoldOut', { name: localized(item.name) }))
      return
    }
    // Something to choose first: open it instead
    if (!canQuickAdd(item)) {
      setTuning({ item, tone: toneOf(item) })
      return
    }
    navigator.vibrate?.(8)
    if (holdHint.pending) holdHint.done()
    const { customizations, unitPrice } = quickAddChoice(item)
    addLine(item, { customizations, unitPrice, quantity: 1, instructions: '' })
    fly(item, photo, toneOf(item))
    // Nothing opened to show what went in: the toast names it, with its photo
    toast.success(t('counterAdded', { name: localized(item.name) }), {
      icon: item.pictureUri ? <img src={itemPictureUrl(item.id)} alt='' className='size-5 rounded-full object-cover' /> : undefined,
      duration: 2200,
    })
  }

  const onKeepHolding = () => {
    if (keepHoldingToast.current) toast.dismiss(keepHoldingToast.current)
    keepHoldingToast.current = toast.info(t('counterKeepHolding'), { duration: 1800 })
  }

  const labels = columns.map((c) => c.label)

  return (
    <MotionConfig reducedMotion='user'>
      <LayoutGroup>
        <div
          className={cn(
            'bg-background fixed inset-x-0 top-[env(safe-area-inset-top)] z-10 mx-auto flex max-w-lg flex-col md:top-(--header-h) md:bottom-0',
            counterChrome ? 'bottom-0' : 'bottom-[calc(3.5rem+env(safe-area-inset-bottom))]'
          )}
          onPointerDownCapture={noteInput}
          onTouchStartCapture={noteInput}
          onWheelCapture={noteInput}
          onKeyDownCapture={noteInput}
        >
          <div className='relative flex min-h-0 flex-1 flex-col'>
            {/* The first-visit demonstrations move the whole deck: a nudge up, then a breath out to the whole menu */}
            <motion.div
              className='min-h-0 flex-1'
              animate={
                swipeHint.showing
                  ? { y: [0, -56, 0, -28, 0], scale: 1 }
                  : zoomHint.showing
                    ? { scale: [1, 0.9, 0.9, 1], y: 0 }
                    : { scale: 1, y: 0 }
              }
              transition={{ duration: swipeHint.showing ? 1.6 : 2.2, times: swipeHint.showing ? [0, 0.3, 0.55, 0.75, 1] : [0, 0.3, 0.7, 1], ease: 'easeInOut', delay: 0.2 }}
            >
              {loading ? (
                <div className='h-full px-4 pb-14' style={{ paddingTop: DECK_TOP }}>
                  <div className='bg-muted h-full animate-pulse rounded-[28px] motion-reduce:animate-none' />
                </div>
              ) : columns.length === 0 ? (
                <p className='text-muted-foreground grid h-full place-items-center px-8 text-center'>{t('noItemsAvailable')}</p>
              ) : mode === 'grid' ? (
                <MenuGrid columns={columns} focusId={gridFocus.id} sharedIds={gridFocus.shared} onPick={(item) => zoomIn(item)} onZoomIn={() => zoomIn()} />
              ) : (
                <Deck
                  key={deckKey}
                  columns={columns}
                  column={column}
                  onColumnChange={selectColumn}
                  onRowChange={onRowChange}
                  start={start}
                  usualId={usual ? Number(usual.id) : null}
                  holdHintId={holdHintId}
                  onOpen={(item) => setTuning({ item, tone: toneOf(item) })}
                  onQuickAdd={onQuickAdd}
                  onZoom={onZoom}
                />
              )}
            </motion.div>

            {/* The bar over the cards: the café, where you are; on the whole menu, the way back */}
            <CounterTopBar
              className='absolute inset-x-0 top-0 md:flex'
              start={
                mode === 'grid' ? (
                  <button type='button' onClick={() => zoomIn()} className='-ms-2 flex min-w-0 items-center gap-1.5 rounded-full py-2 ps-2 pe-3'>
                    <ArrowLeft className='size-5 shrink-0 rtl:rotate-180' />
                    <span className='heading truncate text-[calc(1.15rem*var(--heading-scale))]'>{t('counterWholeMenu')}</span>
                  </button>
                ) : undefined
              }
            />
            {!canOrder && (
              <div className='absolute inset-x-4 z-20' style={{ top: DECK_TOP }}>
                <OrderingPausedNote className='shadow-sm backdrop-blur' />
              </div>
            )}

            {/* The categories, in the thumb's reach */}
            {mode === 'deck' && columns.length > 0 && (
              <nav aria-label={t('menu')} className='shrink-0 pb-1'>
                <LiquidTabs labels={labels} active={column} onSelect={selectColumn} onZoomOut={zoomOut} />
              </nav>
            )}

            <AnimatePresence>
              {swipeHint.showing && (
                <div key='swipe' className='pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center'>
                  <HintBubble>
                    <MoveVertical className='size-3.5' />
                    {t('counterHintSwipe')}
                  </HintBubble>
                </div>
              )}
              {zoomHint.showing && (
                <div key='zoom' className='pointer-events-none absolute end-3 bottom-14 z-20'>
                  <HintBubble>
                    <LayoutGrid className='size-3.5' />
                    {t('counterHintZoom')}
                  </HintBubble>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {tuning && (
                <Tune
                  key={String(tuning.item.id)}
                  item={tuning.item}
                  tone={tuning.tone}
                  canOrder={canOrder}
                  onClose={() => setTuning(null)}
                  onAdd={(result, photo) => {
                    addLine(tuning.item, result)
                    fly(tuning.item, photo, tuning.tone)
                    setTuning(null)
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* The order opened darkens what is behind it, not the dock itself */}
          <AnimatePresence>
            {expanded && (
              <motion.div
                key='scrim'
                aria-hidden
                className='fixed inset-0 z-30 bg-black/40'
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpanded(false)}
              />
            )}
          </AnimatePresence>

          {/* One dock: the tray over the app's tabs, a single dark slab floating off the edges */}
          <div
            className={'bg-foreground text-background relative z-40 shrink-0 rounded-[1.75rem] shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)]'}
            style={{ marginInline: DOCK_INSET, marginBottom: counterChrome ? `max(${DOCK_INSET}px, env(safe-area-inset-bottom))` : DOCK_INSET }}
          >
            <Tray
              targetRef={target}
              bump={bump}
              expanded={expanded}
              onExpandedChange={setExpanded}
              canOrder={canOrder}
              order={order}
              cloudKitchen={cloudKitchen}
              onSignIn={() => setSignInOpen(true)}
              onKeepHolding={onKeepHolding}
            />
            {counterChrome && <CounterNav className='border-background/10 border-t' />}
          </div>
        </div>

        <FlightLayer
          flights={flights}
          onLand={(id) => {
            setFlights((f) => f.filter((x) => x.id !== id))
            setBump((b) => b + 1)
          }}
        />
        <p aria-live='polite' className='sr-only'>
          {announce}
        </p>
        {order.dialogs}
        <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
      </LayoutGroup>
    </MotionConfig>
  )
}
