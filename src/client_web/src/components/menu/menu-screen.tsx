import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { animate, AnimatePresence, LayoutGroup, motion, MotionConfig, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { ArrowLeft, LayoutGrid, MoveVertical } from 'lucide-react'
import type { CatalogItemDto } from '@/api/catalog'
import { useIsCloudKitchen } from '@/lib/brand'
import { useCart } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { useLiveBills } from '@/lib/live-bills'
import { useOrderPill } from '@/lib/order-pill'
import { toast } from '@/lib/toast'
import { useCheckoutExtras } from '@/lib/use-checkout-extras'
import { usePlaceOrder } from '@/lib/use-place-order'
import { cn } from '@/lib/utils'
import { SignInSheet } from '@/components/auth/sign-in-options'
import { GestureHint } from '@/components/ninja/gestures/gesture-hint'
import { GESTURE_DELAY_S, GESTURE_GAP_S, GESTURE_S, gestureMs } from '@/components/ninja/gestures/gesture-timing'
import { HintBubble } from '@/components/ninja/gestures/hint-bubble'
import { useHint, useTimeout } from '@/components/ninja/gestures/use-hint'
import { DECK_COMPACT_TOP, DECK_TOP, DOCK_INSET, DOCK_SIDE, TABS_H } from '@/components/ninja/shell/chrome'
import { DockBill } from '@/components/ninja/shell/dock-bill'
import { TuckedTabs } from '@/components/ninja/shell/nav'
import { NinjaTopBar } from '@/components/ninja/shell/top-bar'
import { useDockRowShown } from '@/components/ninja/shell/use-dock-row'
import { useTuck, useTuckOnScroll } from '@/components/ninja/shell/use-tuck'
import { Tray } from '@/components/tray/tray'
import { LiquidTabs } from './category-tabs'
import type { HomeProps } from './data/use-menu'
import { Deck, type DeckPosition } from './deck/deck'
import { buildDeck, canQuickAdd, pickUsual, positionOf, quickAddChoice, TONE_CLASS } from './deck/deck-model'
import { FlightLayer, type Flight } from './flights'
import { itemPictureUrl } from './item-picture'
import { MenuGrid } from './list/menu-grid'
import { useMenuStyle } from './menu-style'
import { OrderingPausedNote } from './paused-note'
import { Tune, type TuneResult } from './tune'

/** The dish open in place; `leaving` once it was added and its photo has taken off */
type Tuning = { item: CatalogItemDto; leaving?: boolean }

/**
 * The menu tab: ordering as one surface that never leaves the page, in the
 * style the café chose (./menu-style.ts). A list (the default) or the tiles
 * are one scrolling page under the tab's title (./list/menu-grid.tsx). On
 * the deck, dishes are big cards (up and down within a category, sideways
 * between them). Either way a dish opens in place into its options; what is added flies into
 * the tray; and a held press sends the order through the same path the cart
 * page uses, after which the order pill at the top takes over. Pinch, or tap
 * the category again, to see the whole menu. The bar at the top goes up
 * past the first card, the dock's tabs folding with it, so a small screen
 * gives the cards its room; the tray and the app's tabs are one dock below.
 * The gestures are each acted out once by a fingertip, on a first visit.
 */
export function MenuScreen({ menu }: HomeProps) {
  const t = useT()
  const localized = useLocalized()
  const reduced = useReducedMotion()
  const cloudKitchen = useIsCloudKitchen()
  const add = useCart((s) => s.add)
  const trayEmpty = useCart((s) => s.lines.length === 0)
  const live = useLiveBills()
  // An empty tray with nothing to show in its place (no bill, order, table or room) takes no row until a dish is on its way
  const dockRow = useDockRowShown(live)

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
  const [pastFirst, setPastFirst] = useState(false)
  // The tabs keep the rule they have on every page: a card on (scrolling down) puts them away, a
  // card back (scrolling up) brings them back, as does the first card (the top)
  const [tabsAsked, setTabsAsked] = useState(false)

  // The café's own menu (a list, or the tiles alone) is the whole menu from the start, with no cards
  // to zoom back into; the deck opens on its cards
  const style = useMenuStyle()
  const list = style.kind === 'list' ? style.list : undefined
  const classic = style.kind !== 'deck'
  const [chosenMode, setMode] = useState<'deck' | 'grid'>('deck')
  const mode = classic ? 'grid' : chosenMode
  const [gridFocus, setGridFocus] = useState<{ id: number | null; shared: Set<number> }>({ id: null, shared: new Set() })
  const [tuning, setTuning] = useState<Tuning | null>(null)
  const [expanded, setExpanded] = useState(false)
  // How far the order sheet is open (it follows a finger), and so how dark the page behind it is
  const openness = useMotionValue(0)
  const [scrim, setScrim] = useState(false)
  useMotionValueEvent(openness, 'change', (v) => setScrim(v > 0.001))
  const [flights, setFlights] = useState<Flight[]>([])
  const bare = trayEmpty && !dockRow && flights.length === 0

  // The whole menu scrolls like a page: the top bar goes up with it, and scrolling down tucks the
  // dock's tabs (the tray staying), scrolling back up brings them back
  const [gridScroller, setGridScroller] = useState<HTMLDivElement | null>(null)
  useTuckOnScroll(gridScroller, gridScroller != null && !expanded)
  const scrolledDown = useTuck((s) => s.tucked)
  // The deck goes compact past its first card: the top bar goes up, the tabs fold and the cards grow
  // into both. By where the customer is rather than which way they last swiped, so going back a
  // card to compare two dishes keeps the room; the first card brings the chrome back
  const compact = mode === 'deck' && pastFirst && columns.length > 0
  // Asked back on the compact deck, the tabs come up over the next card's peek rather than taking
  // the cards' room: the categories and the dock rise over the deck's bottom, the cards unmoved
  const tabsOver = compact && tabsAsked
  const tucked = gridScroller ? scrolledDown : compact && !tabsAsked
  // The top bar goes up with the whole menu's scroll, and past the deck's first card: as far as it
  // is tall, which is the café's (its header size)
  const bar = useRef<HTMLDivElement>(null)
  const barHeight = () => bar.current?.offsetHeight ?? 64
  const barY = useMotionValue(0)
  useEffect(() => {
    if (gridScroller) {
      const follow = () => barY.set(-Math.min(gridScroller.scrollTop, barHeight()))
      follow()
      gridScroller.addEventListener('scroll', follow, { passive: true })
      return () => gridScroller.removeEventListener('scroll', follow)
    }
    const run = animate(barY, compact ? -barHeight() : 0, reduced ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' })
    return () => run.stop()
  }, [gridScroller, compact, barY, reduced])
  // Nothing in the tray's row and the tabs tucked: the dock is gone, the categories left at the bottom
  const docked = !(tucked && bare)
  // The tabs tucked with the tray's row kept: the row settles onto the screen's bottom edge, full
  // width, rounded on top only, rather than floating over a strip of page
  const stuck = tucked && !bare
  // The dish added from its open card: that card sits out while its photo flies, and comes back as it lands
  const [landing, setLanding] = useState<number | null>(null)
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

  // The note, the code and the points, set in the tray's order and sent with it
  const extras = useCheckoutExtras()

  const order = usePlaceOrder({
    onPlaced: (finish) => {
      setExpanded(false)
      extras.reset()
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
  useTimeout(!!current?.showing, gestureMs(current === swipeHint ? 'swipe' : current === zoomHint ? 'pinch' : 'hold'), () => current?.done())
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
    const was = rows.current[c] ?? 0
    rows.current[c] = row
    if (c !== column) return
    // Only a swipe through the cards moves the chrome: turning to another category (which opens on
    // its first card) keeps it as it was. These flip only when the card changes, so scrolling
    // between cards re-renders nothing
    if (row === was) return
    setPastFirst(row > 0)
    setTabsAsked(row < was)
    // Only the first visit's "hold to add" cue needs the row as state; a
    // re-render here on every card scrolled past re-measured the whole deck
    // for its shared layouts and made the scroll stutter
    if (row !== activeRow && holdHint.pending) setActiveRow(row)
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

  // On the whole menu: the category in view, and the one the jump bar asked to scroll to
  const [gridColumn, setGridColumn] = useState(0)
  const [jump, setJump] = useState<{ index: number; n: number } | null>(null)

  const zoomIn = useCallback(
    (item?: CatalogItemDto) => {
      const position = item ? positionOf(columns, item.id) : { column, row: rows.current[column] ?? 0 }
      if (position) {
        setTouched(true)
        setActiveId(columns[position.column]?.id ?? null)
        setMoved(position)
        setActiveRow(position.row)
        setPastFirst(position.row > 0)
        // Back from the whole menu is a page opened afresh, which starts with its tabs
        setTabsAsked(true)
      }
      setMode('deck')
    },
    [columns, column]
  )

  const onZoom = useCallback((direction: 'out' | 'in') => (direction === 'out' ? zoomOut() : zoomIn()), [zoomOut, zoomIn])

  /** A photo lifts off where it is and flies into the tray; `land` runs as it gets there */
  const fly = (item: CatalogItemDto, from: HTMLElement | null, land: () => void) => {
    setAnnounce(t('ninjaAdded', { name: localized(item.name) }))
    const to = target.current?.getBoundingClientRect()
    const box = from?.getBoundingClientRect()
    if (reduced || !to || !box || box.width === 0) {
      land()
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
        toneClass: TONE_CLASS.primary,
        radius: cornerOf(from),
        land,
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


  const onQuickAdd = (item: CatalogItemDto, photo: HTMLElement | null) => {
    if (!canOrder) {
      toast.warning(t('orderingUnavailable'))
      return
    }
    if (item.isAvailable === false) {
      toast.warning(t('ninjaSoldOut', { name: localized(item.name) }))
      return
    }
    // Something to choose first: open it instead
    if (!canQuickAdd(item)) {
      setTuning({ item })
      return
    }
    navigator.vibrate?.(8)
    if (holdHint.pending) holdHint.done()
    const { customizations, unitPrice } = quickAddChoice(item)
    fly(item, photo, () => addLine(item, { customizations, unitPrice, quantity: 1, instructions: '' }))
  }

  const onKeepHolding = () => {
    if (keepHoldingToast.current) toast.dismiss(keepHoldingToast.current)
    keepHoldingToast.current = toast.info(t('ninjaKeepHolding'), { duration: 1800 })
  }

  const labels = columns.map((c) => c.label)
  // The whole menu shows the categories alone (each usual is a tile in its own category)
  const gridCategories = columns.filter((c) => c.kind === 'category')
  const gridLabels = gridCategories.map((c) => c.label)

  return (
    <MotionConfig reducedMotion='user'>
      <LayoutGroup>
        <div
          className='bg-background fixed inset-x-0 top-[env(safe-area-inset-top)] bottom-0 z-10 mx-auto flex max-w-lg flex-col'
          onPointerDownCapture={noteInput}
          onTouchStartCapture={noteInput}
          onWheelCapture={noteInput}
          onKeyDownCapture={noteInput}
        >
          <div className='relative flex min-h-0 flex-1 flex-col'>
            {/* The first-visit demonstrations move the whole deck: a nudge up, then a breath out to the whole menu */}
            <motion.div
              className='deck-top min-h-0 flex-1'
              style={{ '--deck-top': compact ? `${DECK_COMPACT_TOP}px` : DECK_TOP } as CSSProperties}
              animate={
                swipeHint.showing
                  ? { y: [0, -56, 0, -28, 0], scale: 1 }
                  : zoomHint.showing
                    ? { scale: [1, 0.9, 0.9, 1], y: 0 }
                    : { scale: 1, y: 0 }
              }
              // Twice, in step with the fingertip acting the gesture out over it
              transition={
                swipeHint.showing || zoomHint.showing
                  ? {
                      duration: GESTURE_S[swipeHint.showing ? 'swipe' : 'pinch'],
                      times: swipeHint.showing ? [0, 0.3, 0.55, 0.75, 1] : [0, 0.3, 0.7, 1],
                      ease: 'easeInOut',
                      delay: GESTURE_DELAY_S,
                      repeat: 1,
                      repeatDelay: GESTURE_GAP_S,
                    }
                  : { duration: 0.3 }
              }
            >
              {loading ? (
                <div className='h-full px-4 pb-14' style={{ paddingTop: DECK_TOP }}>
                  <div className='bg-muted h-full animate-pulse rounded-[28px] motion-reduce:animate-none' />
                </div>
              ) : columns.length === 0 ? (
                <p className='text-muted-foreground grid h-full place-items-center px-8 text-center'>{t('noItemsAvailable')}</p>
              ) : mode === 'grid' ? (
                <MenuGrid
                  columns={columns}
                  focusId={gridFocus.id}
                  sharedIds={gridFocus.shared}
                  onOpen={(item) => setTuning({ item })}
                  onQuickAdd={onQuickAdd}
                  onZoomIn={() => (classic ? undefined : zoomIn())}
                  landingId={landing}
                  jump={jump}
                  onSection={setGridColumn}
                  list={list}
                  // The café's own menu opens under the page's large title, as every tab does; the deck zoomed out has the way back in its bar
                  title={classic ? t('menu') : undefined}
                  onScroller={setGridScroller}
                  notice={canOrder ? undefined : <OrderingPausedNote />}
                />
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
                  onOpen={(item) => setTuning({ item })}
                  onQuickAdd={onQuickAdd}
                  onZoom={onZoom}
                  landingId={landing}
                />
              )}
            </motion.div>

            {/* The bar over the cards: the café, where you are; on the whole menu, the way back */}
            <NinjaTopBar
              ref={bar}
              className='absolute inset-x-0 top-0'
              style={{ y: barY }}
              start={
                mode === 'grid' && !classic ? (
                  <button type='button' onClick={() => zoomIn()} className='-ms-2 flex min-w-0 items-center gap-1.5 rounded-full py-2 ps-2 pe-3'>
                    <ArrowLeft className='size-5 shrink-0 rtl:rotate-180' />
                    <span className='heading truncate text-[calc(1.15rem*var(--heading-scale))]'>{t('ninjaWholeMenu')}</span>
                  </button>
                ) : undefined
              }
            />
            {/* On the cards, over the first one as the top bar is, and gone with it past there (the whole menu has it at its top) */}
            {!canOrder && mode === 'deck' && (
              <motion.div
                className='bg-background absolute inset-x-4 z-20 rounded-[1.5rem] shadow-(--slab-shadow)'
                style={{ top: DECK_TOP }}
                initial={false}
                animate={{ opacity: compact ? 0 : 1, y: compact ? -24 : 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                inert={compact || undefined}
              >
                <OrderingPausedNote />
              </motion.div>
            )}

            {/* The categories, in the thumb's reach: on the cards they turn the deck, on the whole menu they jump to their heading */}
            {columns.length > 0 && (
              <nav
                aria-label={t('menu')}
                // A soft shadow along its top edge sets it apart from the cards or the tiles running up to it
                className='bg-background relative z-10 shrink-0 pb-1 shadow-[0_-10px_18px_-14px_rgb(0_0_0/0.35)] transition-[margin] duration-300 ease-out motion-reduce:transition-none'
                style={{ marginTop: tabsOver ? -TABS_H : 0 }}
              >
                {mode === 'deck' ? (
                  <LiquidTabs labels={labels} active={column} onSelect={selectColumn} onZoomOut={zoomOut} />
                ) : (
                  <LiquidTabs
                    zoomed
                    labels={gridLabels}
                    active={gridColumn}
                    onSelect={(index) => setJump((j) => ({ index, n: (j?.n ?? 0) + 1 }))}
                    // Back to the cards at the category in view, or where the deck was if that is the one; a classic menu has none
                    onZoomOut={
                      classic
                        ? undefined
                        : () => {
                            const shown = gridCategories[gridColumn]
                            zoomIn(shown && shown.id !== columns[column]?.id ? shown.items[0] : undefined)
                          }
                    }
                  />
                )}
              </nav>
            )}

            <AnimatePresence>
              {swipeHint.showing && <GestureHint key='swipe-tip' kind='swipe' />}
              {zoomHint.showing && <GestureHint key='pinch-tip' kind='pinch' />}
              {holdHintId != null && <GestureHint key='hold-tip' kind='hold' />}
            </AnimatePresence>
            <AnimatePresence>
              {swipeHint.showing && (
                <div key='swipe' className='pointer-events-none absolute inset-x-0 bottom-14 z-20 flex justify-center'>
                  <HintBubble>
                    <MoveVertical className='size-3.5' />
                    {t('ninjaHintSwipe')}
                  </HintBubble>
                </div>
              )}
              {zoomHint.showing && (
                <div key='zoom' className='pointer-events-none absolute end-3 bottom-14 z-20'>
                  <HintBubble>
                    <LayoutGrid className='size-3.5' />
                    {t('ninjaHintZoom')}
                  </HintBubble>
                </div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {tuning && (
                <Tune
                  key={String(tuning.item.id)}
                  item={tuning.item}
                  canOrder={canOrder}
                  onClose={() => setTuning(null)}
                  leaving={tuning.leaving}
                  onAdd={(result, photo) => {
                    // The photo itself goes to the tray: the open card lets go of it and fades,
                    // rather than folding back into its card while a copy flies
                    const item = tuning.item
                    setLanding(Number(item.id))
                    fly(item, photo, () => {
                      addLine(item, result)
                      setLanding(null)
                    })
                    setTuning({ ...tuning, leaving: true })
                    requestAnimationFrame(() => setTuning(null))
                  }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* The order opened darkens what is behind it, not the dock itself */}
          {scrim && (
            <motion.div
              aria-hidden
              className='fixed inset-0 z-30 bg-black/40'
              style={{ opacity: openness }}
              onClick={() => setExpanded(false)}
            />
          )}

          {/* One dock: the tray over the app's tabs, a single dark slab floating off the edges */}
          <div
            className={cn(
              'slab relative z-40 shrink-0 transition-[margin,padding,border-radius,box-shadow] duration-300 ease-out motion-reduce:transition-none',
              stuck ? 'rounded-t-[1.75rem] rounded-b-none' : 'rounded-[1.75rem]',
              docked && 'shadow-(--slab-shadow)'
            )}
            style={{
              marginInline: stuck ? 0 : DOCK_SIDE,
              marginBottom: stuck ? 0 : docked ? `max(${DOCK_INSET}px, env(safe-area-inset-bottom))` : 'env(safe-area-inset-bottom)',
              paddingBottom: stuck ? 'env(safe-area-inset-bottom)' : undefined,
            }}
          >
            <Tray
              targetRef={target}
              bump={bump}
              expanded={expanded}
              onExpandedChange={setExpanded}
              openness={openness}
              canOrder={canOrder}
              // The hold sends the note, the code and the points set in the order with it
              order={{ ...order, submit: () => order.submit(extras.payload()) }}
              extras={extras}
              bare={bare}
              cloudKitchen={cloudKitchen}
              onSignIn={() => setSignInOpen(true)}
              onKeepHolding={onKeepHolding}
            />
            {/* The bill running now, in the tray's row while the tray is empty */}
            <DockBill live={live} trayEmpty={trayEmpty} />
            {/* Scrolling down the whole menu folds the tabs, the tray staying: the order is what is at hand */}
            <TuckedTabs tucked={tucked} className={bare ? undefined : 'border-background/10 border-t'} />
          </div>
        </div>

        <FlightLayer
          flights={flights}
          onLand={(id) => {
            flights.find((x) => x.id === id)?.land()
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

/**
 * The corner a photo is seen with: its own, or that of the card clipping it
 * (a deck card rounds its photo; an open card's photo is square), so a
 * flight starts with exactly the corners that were on screen
 */
function cornerOf(el: HTMLElement | null): number {
  for (let node = el, depth = 0; node && depth < 3; node = node.parentElement, depth++) {
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius)
    if (radius > 0) return radius
  }
  return 0
}
