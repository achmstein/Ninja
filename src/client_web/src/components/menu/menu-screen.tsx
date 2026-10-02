import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { animate, AnimatePresence, LayoutGroup, motion, MotionConfig, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from 'motion/react'
import { ArrowLeft, LayoutGrid, MoveVertical } from 'lucide-react'
import { useStore } from 'zustand'
import type { CatalogItemDto } from '@/api/catalog'
import { useIsCloudKitchen } from '@/lib/brand'
import { useCart, type CartLine } from '@/lib/cart'
import { useLocalized, useT } from '@/lib/i18n'
import { useLiveBills } from '@/lib/live-bills'
import { useOrderPill } from '@/lib/order-pill'
import { toast } from '@/lib/toast'
import { useCheckoutExtras } from '@/lib/use-checkout-extras'
import { useHandler } from '@/lib/use-handler'
import { usePlaceOrder } from '@/lib/use-place-order'
import { cn } from '@/lib/utils'
import { SignInSheet } from '@/components/auth/sign-in-options'
import { GestureHint } from '@/components/ninja/gestures/gesture-hint'
import { GESTURE_DELAY_S, GESTURE_GAP_S, GESTURE_S, gestureMs } from '@/components/ninja/gestures/gesture-timing'
import { HintBubble } from '@/components/ninja/gestures/hint-bubble'
import { useHint, useNoCueOnScreen, useTimeout } from '@/components/ninja/gestures/use-hint'
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
import { createMenuScreenStore, type MenuScreenStore, type Tuning } from './menu-screen-store'
import { useMenuStyle } from './menu-style'
import { MAX_ON_SHEET, menuById, pairedFor } from './paired-items'
import { OrderingPausedNote } from './paused-note'
import { cornerOf } from './photo-corner'
import { FLIGHT_SPRING, FlyingPhoto, planFlight, type Flight as PhotoFlight } from './photo-flight'
import { Tune, type TuneResult } from './tune'

/**
 * The menu tab: ordering as one surface that never leaves the page, in the
 * style the business chose (./menu-style.ts). A list (the default) or the tiles
 * are one scrolling page under the tab's title (./list/menu-grid.tsx). On
 * the deck, dishes are big cards (up and down within a category, sideways
 * between them). Either way a dish opens in place into its options; what is added flies into
 * the tray; and a held press sends the order through the same path the cart
 * page uses, after which the order pill at the top takes over. Pinch, or tap
 * the category again, to see the whole menu. The bar at the top goes up
 * past the first card, the dock's tabs folding with it, so a small screen
 * gives the cards its room; the tray and the app's tabs are one dock below.
 * The gestures are each acted out once by a fingertip, on a first visit.
 *
 * The screen itself holds only what moves between the deck and the whole
 * menu. What a tap or a scroll changes (the dish open, the photos in the
 * air, the tray, the tuck, the category in view) is read by the part that
 * shows it (./menu-screen-store.ts), so none of those renders the menu.
 */
export function MenuScreen({ menu }: HomeProps) {
  const t = useT()
  const localized = useLocalized()
  const reduced = useReducedMotion()
  const add = useCart((s) => s.add)
  const [store] = useState(createMenuScreenStore)

  const columns = useMemo(() => buildDeck(menu.sections), [menu.sections])
  const usual = pickUsual(columns)
  // The deck is keyed by its columns: the usuals arrive a moment after the menu, and the deck then opens on them
  const deckKey = columns.map((c) => c.id).join('|')

  const [activeId, setActiveId] = useState<string | null>(null)
  const [moved, setMoved] = useState<DeckPosition>({ column: 0, row: 0 })
  // Until the customer moves, the deck sits on its first column (the usuals once they land)
  const [touched, setTouched] = useState(false)
  const column = touched ? Math.max(0, columns.findIndex((c) => c.id === activeId)) : 0
  const start = useMemo<DeckPosition>(() => (touched ? moved : { column: 0, row: 0 }), [touched, moved])
  const rows = useRef<Record<number, number>>({})
  const [activeRow, setActiveRow] = useState(0)
  const [pastFirst, setPastFirst] = useState(false)
  // The tabs keep the rule they have on every page: a card on (scrolling down) puts them away, a
  // card back (scrolling up) brings them back, as does the first card (the top)
  const [tabsAsked, setTabsAsked] = useState(false)

  // The business's own menu (a list, or the tiles alone) is the whole menu from the start, with no cards
  // to zoom back into; the deck opens on its cards
  const style = useMenuStyle()
  const list = style.kind === 'list' ? style.list : undefined
  const classic = style.kind !== 'deck'
  const [chosenMode, setMode] = useState<'deck' | 'grid'>('deck')
  const mode = classic ? 'grid' : chosenMode
  // The dish the deck was on, which the whole menu opens scrolled to
  const [gridFocus, setGridFocus] = useState<number | null>(null)

  // Between the deck and the whole menu, both are on screen for the move: the one left fades out as
  // the one arrived fades in, and the photos of the cards on screen fly to their tiles (or back from
  // them), all on the one spring. The one left goes once it settles. `zooming` is the view being
  // left, until its flights are planned (after the render that brings the other in)
  const stage = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState<'deck' | 'grid' | null>(null)
  const [zoomFlights, setZoomFlights] = useState<PhotoFlight[]>([])
  const zooming = useRef<'deck' | 'grid' | null>(null)
  const zoomProgress = useMotionValue(1)
  const arriving = useTransform(zoomProgress, [0, 0.5], [0, 1])
  const going = useTransform(zoomProgress, [0, 0.4], [1, 0])
  /** Starts a move away from `from`; false while one is still under way (they go one at a time) */
  const beginZoom = (from: 'deck' | 'grid') => {
    if (leaving) return false
    if (!reduced) {
      zooming.current = from
      setLeaving(from)
    }
    return true
  }

  // The whole menu scrolls like a page: the top bar goes up with it, and scrolling down tucks the
  // dock's tabs (the tray staying), scrolling back up brings them back. The dock follows that
  // itself (MenuDock), so a scroll never renders the screen
  const [gridScroller, setGridScroller] = useState<HTMLDivElement | null>(null)
  // The deck goes compact past its first card: the top bar goes up, the tabs fold and the cards grow
  // into both. By where the customer is rather than which way they last swiped, so going back a
  // card to compare two dishes keeps the room; the first card brings the chrome back
  // Held as it was while the deck is being left, so its cards do not change size under their flying photos
  const compact = (mode === 'deck' || leaving === 'deck') && pastFirst && columns.length > 0
  // Asked back on the compact deck, the tabs come up over the next card's peek rather than taking
  // the cards' room: the categories and the dock rise over the deck's bottom, the cards unmoved
  const tabsOver = compact && tabsAsked
  // The top bar goes up with the whole menu's scroll, and past the deck's first card: as far as it
  // is tall, which is the business's (its header size)
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
  const target = useRef<HTMLDivElement>(null)
  const flightId = useRef(0)
  // When the guest last touched the page: a scroll only counts as their swipe
  // if they were touching it (a resize or the browser's bars re-snapping the
  // deck scrolls it too, and must not end the swipe cue)
  const lastInput = useRef(0)
  const noteInput = () => {
    lastInput.current = performance.now()
  }
  const byGuest = () => performance.now() - lastInput.current < 1500

  const canOrder = menu.orderingEnabled
  const loading = menu.isLoading && columns.length === 0

  // First visit: each gesture shown once, one after another, while nothing else is going on
  const swipeHint = useHint('swipe')
  const zoomHint = useHint('zoom')
  const holdHint = useHint('holdAdd')
  const current = swipeHint.pending ? swipeHint : zoomHint.pending ? zoomHint : holdHint.pending ? holdHint : null
  // A dish or the order open over the deck is something going on. Only a cue still to show asks: with
  // none left, or on the whole menu (which has none), opening either does not render the screen
  const covered = useStore(store, (s) => current != null && mode === 'deck' && (s.tuning != null || s.expanded))
  const idle = !loading && columns.length > 0 && mode === 'deck' && !covered
  // One cue on screen at a time (the tray's pull may be up); and one showing as a dish or the order
  // opens is over, so no fingertip or words are left over what opened
  const noCue = useNoCueOnScreen()
  const endCue = current?.showing && !idle ? current.done : null
  useEffect(() => {
    endCue?.()
  }, [endCue])
  const activeItem = columns[column]?.items[activeRow]
  // "Hold to add" waits for a card a long press would add straight away
  const cueFits = current !== holdHint || (!!activeItem && canQuickAdd(activeItem))
  useTimeout(idle && noCue && cueFits && current != null && !current.showing, 1400, () => current?.show())
  useTimeout(!!current?.showing, gestureMs(current === swipeHint ? 'swipe' : current === zoomHint ? 'pinch' : 'hold'), () => current?.done())
  const holdHintId = holdHint.showing && activeItem && canQuickAdd(activeItem) ? Number(activeItem.id) : null

  const labels = columns.map((c) => c.label)
  // The whole menu shows the categories alone (each usual is a tile in its own category)
  const gridCategories = columns.filter((c) => c.kind === 'category')
  const gridLabels = gridCategories.map((c) => c.label)

  // The deck, the list and the dock are memoised and keep the same handlers from render to render
  // (each runs the latest of what is below), so a render of the screen passes them by
  const selectColumn = useHandler((index: number) => {
    setTouched(true)
    setActiveId(columns[index]?.id ?? null)
    setActiveRow(rows.current[index] ?? 0)
    if (swipeHint.pending && byGuest()) swipeHint.done()
  })

  const onRowChange = useHandler((c: number, row: number) => {
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
  })

  const zoomOut = useHandler(() => {
    if (!beginZoom('deck')) return
    const col = columns[column]
    const row = rows.current[column] ?? 0
    setGridFocus(col?.items[row] ? Number(col.items[row].id) : null)
    store.setState({ tuning: null })
    setMode('grid')
    if (zoomHint.pending) zoomHint.done()
  })

  const zoomIn = useHandler((item?: CatalogItemDto) => {
    if (!beginZoom('grid')) return
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
  })

  // The move planned once the view arrived is on screen, before it is painted: the photos of the deck's
  // cards in view, each with its tile, measured where both are now
  useLayoutEffect(() => {
    const from = zooming.current
    const room = stage.current
    if (!from || !room) return
    zooming.current = null
    const deckView = room.querySelector('[data-view=deck]')
    const gridView = room.querySelector('[data-view=grid]')
    const box = room.getBoundingClientRect()
    const flights = Array.from(deckView?.querySelectorAll<HTMLElement>('[data-photo]') ?? [])
      .filter((card) => {
        const r = card.getBoundingClientRect()
        return r.bottom > box.top && r.top < box.bottom && r.right > box.left && r.left < box.right
      })
      .flatMap((card) => {
        const tile = gridView?.querySelector<HTMLElement>(`[data-photo='${card.dataset.photo}']`) ?? null
        const flight = from === 'deck' ? planFlight(card, tile, room) : planFlight(tile, card, room)
        return flight ? [flight] : []
      })
    setZoomFlights(flights)
    zoomProgress.set(0)
    const run = animate(zoomProgress, 1, FLIGHT_SPRING)
    run.finished.then(() => {
      setLeaving(null)
      setZoomFlights([])
    })
    return () => run.stop()
  }, [mode, zoomProgress])

  const onZoom = useHandler((direction: 'out' | 'in') => (direction === 'out' ? zoomOut() : zoomIn()))
  const zoomInFromGrid = useHandler(() => (classic ? undefined : zoomIn()))
  // Back to the cards at the category in view, or where the deck was if that is the one
  const backToCards = useHandler(() => {
    const shown = gridCategories[store.getState().section]
    zoomIn(shown && shown.id !== columns[column]?.id ? shown.items[0] : undefined)
  })

  /** A photo lifts off where it is and flies into the tray; `land` runs as it gets there */
  const fly = useHandler((item: CatalogItemDto, from: HTMLElement | null, land: () => void) => {
    store.setState({ announce: t('ninjaAdded', { name: localized(item.name) }) })
    const to = target.current?.getBoundingClientRect()
    const box = from?.getBoundingClientRect()
    if (reduced || !to || !box || box.width === 0) {
      land()
      store.setState((s) => ({ bump: s.bump + 1 }))
      return
    }
    const flight: Flight = {
      id: ++flightId.current,
      from: { x: box.x, y: box.y, width: box.width, height: box.height },
      // The first thumbnail's slot
      to: { x: to.x, y: to.y, width: 44, height: 44 },
      src: item.pictureUri ? itemPictureUrl(item, 640) : null,
      toneClass: TONE_CLASS.primary,
      radius: cornerOf(from),
      land,
    }
    store.setState((s) => ({ flights: [...s.flights, flight] }))
  })

  const addLine = useHandler((item: CatalogItemDto, result: TuneResult, suggestion?: CartLine['suggestion']) =>
    add({
      productId: Number(item.id),
      nameEn: item.name?.en ?? '',
      nameAr: item.name?.ar ?? '',
      price: result.unitPrice,
      pictureUrl: item.pictureUri ? itemPictureUrl(item, 320) : undefined,
      quantity: result.quantity,
      specialInstructions: result.instructions || undefined,
      customizations: result.customizations,
      suggestion,
    })
  )

  // Every dish by id, for what a dish goes well with
  const byId = useMemo(() => menuById(menu.sections.flatMap((s) => s.items)), [menu.sections])

  // A dish the open one goes well with: in with its defaults when nothing needs choosing, else open it in its place
  const onSuggest = useHandler((item: CatalogItemDto, photo: HTMLElement | null) => {
    if (!canQuickAdd(item)) {
      store.setState({ tuning: { item, from: photo, suggestion: 'Pairing' } })
      return
    }
    navigator.vibrate?.(8)
    const { customizations, unitPrice } = quickAddChoice(item)
    fly(item, photo, () => addLine(item, { customizations, unitPrice, quantity: 1, instructions: '' }, 'Pairing'))
  })

  const openDish = useHandler((item: CatalogItemDto, from: HTMLElement | null) => store.setState({ tuning: { item, from } }))

  const onQuickAdd = useHandler((item: CatalogItemDto, photo: HTMLElement | null) => {
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
      store.setState({ tuning: { item, from: photo } })
      return
    }
    navigator.vibrate?.(8)
    if (holdHint.pending) holdHint.done()
    const { customizations, unitPrice } = quickAddChoice(item)
    fly(item, photo, () => addLine(item, { customizations, unitPrice, quantity: 1, instructions: '' }))
  })

  const addFromTune = useHandler((tuning: Tuning, result: TuneResult, photo: HTMLElement | null) => {
    // The photo itself goes to the tray: the open card lets go of it and fades,
    // rather than folding back into its card while a copy flies
    const item = tuning.item
    fly(item, photo, () => addLine(item, result, tuning.suggestion))
    store.setState({ tuning: { ...tuning, leaving: true } })
    requestAnimationFrame(() => afterThisFrame(() => store.setState({ tuning: null })))
  })

  const notice = useMemo(() => (canOrder ? undefined : <OrderingPausedNote />), [canOrder])

  return (
    <MotionConfig reducedMotion='user'>
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
            // Its room at the top eases as the bar comes and goes, except in a move to or from the whole
            // menu, where the cards must be the size their photos fly to
            style={{ '--deck-top': compact ? `${DECK_COMPACT_TOP}px` : DECK_TOP, transition: leaving ? 'none' : undefined } as CSSProperties}
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
            ) : (
              <div ref={stage} className='relative h-full overflow-hidden'>
                {(mode === 'grid' || leaving === 'grid') && (
                  <motion.div
                    key='grid'
                    data-view='grid'
                    style={{ opacity: leaving === 'grid' ? going : arriving }}
                    className={cn('absolute inset-0', leaving === 'grid' && 'pointer-events-none')}
                  >
                    <GridStage
                      store={store}
                      columns={columns}
                      focusId={gridFocus}
                      onOpen={openDish}
                      onQuickAdd={onQuickAdd}
                      onZoomIn={zoomInFromGrid}
                      list={list}
                      // The business's own menu opens under the page's large title, as every tab does; the deck zoomed out has the way back in its bar
                      title={classic ? t('menu') : undefined}
                      onScroller={setGridScroller}
                      notice={notice}
                    />
                  </motion.div>
                )}
                {(mode === 'deck' || leaving === 'deck') && (
                  <motion.div
                    key='deck'
                    data-view='deck'
                    style={{ opacity: leaving === 'deck' ? going : arriving }}
                    className={cn('absolute inset-0', leaving === 'deck' && 'pointer-events-none')}
                  >
                    <Deck
                      key={deckKey}
                      columns={columns}
                      column={column}
                      onColumnChange={selectColumn}
                      onRowChange={onRowChange}
                      start={start}
                      usualId={usual ? Number(usual.id) : null}
                      holdHintId={holdHintId}
                      onOpen={openDish}
                      onQuickAdd={onQuickAdd}
                      onZoom={onZoom}
                    />
                  </motion.div>
                )}
                {zoomFlights.map((flight, i) => (
                  <FlyingPhoto key={i} flight={flight} progress={zoomProgress} />
                ))}
              </div>
            )}
          </motion.div>

          {/* The bar over the cards: the business, where you are; on the whole menu, the way back */}
          <NinjaTopBar
            ref={bar}
            className='absolute inset-x-0 top-0'
            style={{ y: barY }}
            start={
              mode === 'grid' && !classic ? (
                <button type='button' onClick={() => zoomIn()} className='-ms-2 flex min-w-0 items-center gap-1.5 rounded-full py-2 ps-2 pe-3'>
                  <ArrowLeft className='size-5 shrink-0 rtl:rotate-180' />
                  <span className='heading truncate text-headline'>{t('ninjaWholeMenu')}</span>
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
                // A classic menu has no cards to go back to
                <GridTabs store={store} labels={gridLabels} onZoomOut={classic ? undefined : backToCards} />
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
              <div key='swipe' className='pointer-events-none absolute inset-x-0 z-20 flex justify-center' style={{ top: `calc(${DECK_TOP} + 12px)` }}>
                <HintBubble>
                  <MoveVertical className='size-3.5' />
                  {t('ninjaHintSwipe')}
                </HintBubble>
              </div>
            )}
            {zoomHint.showing && (
              <div key='zoom' className='pointer-events-none absolute inset-x-0 z-20 flex justify-center' style={{ top: `calc(${DECK_TOP} + 12px)` }}>
                <HintBubble>
                  <LayoutGrid className='size-3.5' />
                  {t('ninjaHintZoom')}
                </HintBubble>
              </div>
            )}
          </AnimatePresence>

          <TuneLayer store={store} canOrder={canOrder} onAdd={addFromTune} menu={byId} onSuggest={onSuggest} />
        </div>

        <LayoutGroup>
          <MenuDock store={store} target={target} canOrder={canOrder} scroller={gridScroller} deckTucked={compact && !tabsAsked} />
        </LayoutGroup>
      </div>

      <Flights store={store} />
      <Announcer store={store} />
    </MotionConfig>
  )
}

/** The whole menu, with what it follows from the store: the category asked for, and the one in view */
function GridStage({ store, ...props }: Omit<ComponentProps<typeof MenuGrid>, 'jump' | 'onSection'> & { store: MenuScreenStore }) {
  const jump = useStore(store, (s) => s.jump)
  const onSection = useCallback((index: number) => store.setState({ section: index }), [store])
  return <MenuGrid {...props} jump={jump} onSection={onSection} />
}

/** On the whole menu the categories are a jump bar: the pill follows the one in view, a tap scrolls to one */
function GridTabs({ store, labels, onZoomOut }: { store: MenuScreenStore; labels: string[]; onZoomOut?: () => void }) {
  const active = useStore(store, (s) => s.section)
  return (
    <LiquidTabs
      zoomed
      labels={labels}
      active={active}
      onSelect={(index) => store.setState((s) => ({ jump: { index, n: (s.jump?.n ?? 0) + 1 } }))}
      onZoomOut={onZoomOut}
    />
  )
}

/** The dish open in place, over the menu */
function TuneLayer({
  store,
  canOrder,
  onAdd,
  menu,
  onSuggest,
}: {
  store: MenuScreenStore
  canOrder: boolean
  onAdd: (tuning: Tuning, result: TuneResult, photo: HTMLElement | null) => void
  menu: ReadonlyMap<string, CatalogItemDto>
  onSuggest: (item: CatalogItemDto, photo: HTMLElement | null) => void
}) {
  const tuning = useStore(store, (s) => s.tuning)
  const lines = useCart((s) => s.lines)
  return (
    <AnimatePresence>
      {tuning && (
        <Tune
          key={String(tuning.item.id)}
          item={tuning.item}
          canOrder={canOrder}
          from={tuning.from ?? null}
          onClose={() => store.setState({ tuning: null })}
          leaving={tuning.leaving}
          onAdd={(result, photo) => onAdd(tuning, result, photo)}
          // None on a dish that was itself a suggestion: taking one never brings on the next
          suggestions={tuning.suggestion ? [] : pairedFor(tuning.item, menu, lines).slice(0, MAX_ON_SHEET)}
          onSuggest={onSuggest}
        />
      )}
    </AnimatePresence>
  )
}

/** The photos in the air; each lands its dish in the order and gives the tray its nudge */
function Flights({ store }: { store: MenuScreenStore }) {
  const flights = useStore(store, (s) => s.flights)
  const onLand = useCallback(
    (id: number) => {
      store
        .getState()
        .flights.find((x) => x.id === id)
        ?.land()
      store.setState((s) => ({ flights: s.flights.filter((x) => x.id !== id), bump: s.bump + 1 }))
    },
    [store]
  )
  return <FlightLayer flights={flights} onLand={onLand} />
}

function Announcer({ store }: { store: MenuScreenStore }) {
  const announce = useStore(store, (s) => s.announce)
  return (
    <p aria-live='polite' className='sr-only'>
      {announce}
    </p>
  )
}

/**
 * One dock: the tray over the app's tabs, a single dark slab floating off
 * the edges. It keeps the order's own state (open or not, the nudge as a
 * dish lands, the note and the code going with it, the cart it sends), so
 * opening the order or a line changing renders the dock, not the menu.
 */
const MenuDock = memo(function MenuDock({
  store,
  target,
  canOrder,
  scroller,
  deckTucked,
}: {
  store: MenuScreenStore
  target: RefObject<HTMLDivElement | null>
  canOrder: boolean
  /** The whole menu's scroller while it is on screen: its scroll tucks the dock's tabs */
  scroller: HTMLDivElement | null
  /** On the deck: the chrome has made way for the cards past the first one */
  deckTucked: boolean
}) {
  const t = useT()
  const cloudKitchen = useIsCloudKitchen()
  const trayEmpty = useCart((s) => s.lines.length === 0)
  const live = useLiveBills()
  // An empty tray with nothing to show in its place (no bill, order, table or room) takes no row until a dish is on its way
  const dockRow = useDockRowShown(live)
  const inFlight = useStore(store, (s) => s.flights.length > 0)
  const bare = trayEmpty && !dockRow && !inFlight
  const bump = useStore(store, (s) => s.bump)
  const expanded = useStore(store, (s) => s.expanded)
  const setExpanded = useCallback((open: boolean) => store.setState({ expanded: open }), [store])
  useTuckOnScroll(scroller, scroller != null && !expanded)
  // How far the order sheet is open (it follows a finger), and so how dark the page behind it is
  const openness = useMotionValue(0)
  const [scrim, setScrim] = useState(false)
  useMotionValueEvent(openness, 'change', (v) => setScrim(v > 0.001))
  const [signInOpen, setSignInOpen] = useState(false)

  // The note, the code and the points, set in the tray's order and sent with it
  const extras = useCheckoutExtras()

  const order = usePlaceOrder({
    onPlaced: (finish) => {
      setExpanded(false)
      extras.reset()
      store.setState({ announce: t('orderPlacedSuccessfully') })
      // In one render the tray empties (the hold button goes) and the pill at
      // the top grows out of it, to follow the order from here
      useOrderPill.getState().follow()
      finish()
    },
  })

  return (
    <>
      {/* The order opened darkens what is behind it, not the dock itself */}
      {scrim && (
        <motion.div aria-hidden className='fixed inset-0 z-30 bg-black/40' style={{ opacity: openness }} onClick={() => setExpanded(false)} />
      )}

      <DockFrame scroller={scroller} deckTucked={deckTucked} bare={bare}>
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
        />
        {/* The bill running now, in the tray's row while the tray is empty */}
        <DockBill live={live} trayEmpty={trayEmpty} />
      </DockFrame>

      {order.dialogs}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  )
})

/**
 * The dock's slab, the one part of the menu that follows the tuck: it reads
 * the flag itself, so a scroll that flips it restyles the slab and folds the
 * tabs while the tray inside (`children`, made by the dock) is passed by.
 */
function DockFrame({ scroller, deckTucked, bare, children }: { scroller: HTMLDivElement | null; deckTucked: boolean; bare: boolean; children: ReactNode }) {
  const scrolledDown = useTuck((s) => s.tucked)
  const tucked = scroller ? scrolledDown : deckTucked
  // Nothing in the tray's row and the tabs tucked: the dock is gone, the categories left at the bottom
  const docked = !(tucked && bare)
  // The tabs tucked with the tray's row kept: the row settles onto the screen's bottom edge, full
  // width, rounded on top only, rather than floating over a strip of page
  const stuck = tucked && !bare
  return (
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
      {children}
      {/* Scrolling down the whole menu folds the tabs, the tray staying: the order is what is at hand */}
      <TuckedTabs tucked={tucked} className={bare ? undefined : 'border-background/10 border-t'} />
    </div>
  )
}

/**
 * Runs `fn` once the frame in progress has been painted. The store's updates render at once, so one
 * made in a frame callback would render before that frame's paint, where React state set there
 * rendered just after it; the one place that waits a frame on purpose (an added dish's sheet letting go)
 * hands its update on to this, which keeps the frame between its two renders
 */
function afterThisFrame(fn: () => void) {
  window.setTimeout(fn, 0)
}

