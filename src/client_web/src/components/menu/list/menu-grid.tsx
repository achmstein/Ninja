import { memo, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { motion, useScroll } from 'motion/react'
import type { CatalogItemDto } from '@/api/catalog'
import { useHandler } from '@/lib/use-handler'
import { PageTitle } from '@/components/ninja/page/page'
import { TABS_H } from '@/components/ninja/shell/chrome'
import { pinchIntent, type DeckColumn } from '../deck/deck-model'
import { LIST_STYLES, type MenuList } from './dishes'
import { ZoomTile } from './zoom-tile'

export type { MenuList } from './dishes'

/** Below the top of the scroller's room (its top padding), how far a heading may sit and still be the one in view, px */
const SPY_SLACK = 24

/**
 * The menu as one scrolling page: each category a heading over its dishes.
 * Two menus use it. The business's own list (`list`: rows, a photo grid,
 * compact rows or magazine cards) opens under the page's large title, as
 * every tab does. The deck zoomed out shows its cards as small tiles, the
 * photos of the ones that were on screen flying into theirs; a pinch open, or the way
 * back in the bar, returns to the cards. Either way a tap opens a dish's
 * options grown out of it, and a held press puts one straight in the tray.
 * The usuals are not repeated here: each of them is a dish in its category.
 * Memoised, as the deck is: the menu screen around it renders for its own
 * reasons (the chrome, the tray), and none of them is the list's.
 */
export const MenuGrid = memo(function MenuGrid({
  columns,
  focusId,
  onOpen,
  onQuickAdd,
  onZoomIn,
  jump,
  onSection,
  list,
  title,
  titleAction,
  onScroller,
  notice,
}: {
  columns: DeckColumn[]
  /** The item the deck was on, scrolled into view on arrival */
  focusId: number | null
  onOpen: (item: CatalogItemDto, from: HTMLElement | null) => void
  onQuickAdd: (item: CatalogItemDto, photo: HTMLElement | null) => void
  onZoomIn: () => void
  /** A category to scroll to (its index among the categories), asked for by the jump bar; `n` tells two asks apart */
  jump: { index: number; n: number } | null
  /** The category in view changed, as the jump bar lights it */
  onSection: (index: number) => void
  /** The business's own menu (no deck behind it): a row per dish, a photo grid, compact text rows, or magazine cards */
  list?: MenuList
  /** The page's large title over the business's own menu, as every tab has one */
  title?: string
  /** On the title's line, at its end (the menu's search) */
  titleAction?: ReactNode
  /** Its scrolling box, handed up while it is on screen, so the chrome around it can follow its scroll */
  onScroller?: (el: HTMLDivElement | null) => void
  /** A word over the whole menu (ordering paused), the first thing in it and scrolling away with it */
  notice?: ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll({ container: scroller })
  const onScrollerRef = useRef(onScroller)
  useLayoutEffect(() => {
    const hand = onScrollerRef.current
    hand?.(scroller.current)
    return () => hand?.(null)
  }, [])
  const categories = columns.filter((c) => c.kind === 'category')
  // The dishes keep the same two handlers from render to render, so a render of the list (a category
  // asked for) passes every dish by
  const open = useHandler(onOpen)
  const quickAdd = useHandler(onQuickAdd)
  const focusColumn = categories.find((c) => c.items.some((i) => Number(i.id) === focusId))?.id

  // Which category is in view: the last one whose heading has reached the top of the room under
  // the bar. While a jump scrolls there, the bar keeps the one asked for, rather than lighting each
  // one passed
  const sections = useRef<Array<HTMLElement | null>>([])
  const shown = useRef(-1)
  const jumping = useRef(false)
  const spy = () => {
    const el = scroller.current
    if (!el || jumping.current) return
    const line = el.scrollTop + roomTop(el) + SPY_SLACK
    let index = 0
    sections.current.forEach((section, i) => {
      if (section && section.offsetTop <= line) index = i
    })
    // At the end the last one is in view, however short it is. The end is measured with the tabs'
    // room to spare: reaching it brings the dock's tabs back, which shortens the list by their
    // height and would otherwise hand the bar back to the category before
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - TABS_H - 2) index = categories.length - 1
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
    el.scrollTo({ top: Math.max(0, section.offsetTop - roomTop(el)), behavior: 'smooth' })
    const done = () => {
      if (!jumping.current) return
      jumping.current = false
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

  // Arrive with the dish we were on in view, before its photo's flight measures it
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

  const look = list ? LIST_STYLES[list] : null

  return (
    <motion.div
      ref={scroller}
      onScroll={spy}
      // The room under the top bar is every page's: the bar, then the same gap to what comes first
      className='no-scrollbar h-full overflow-y-auto overscroll-y-contain px-4 pt-[calc(var(--bar-h)+var(--page-top))] pb-6 [touch-action:pan-y]'
    >
      {title && <PageTitle title={title} action={titleAction} scrollY={scrollY} className='mb-5' />}
      {notice && <div className='mb-5'>{notice}</div>}
      {categories.map((col, index) => (
        <section
          key={col.id}
          ref={(el) => {
            sections.current[index] = el
          }}
          className='mb-7'
          // Off-screen categories are not drawn until scrolled to; the one the deck was on always is,
          // so the grid can land on the dish it came from
          style={col.id === focusColumn ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 480px' }}
        >
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            // A category is the page's section, in every menu style
            className='heading text-headline mb-3'
          >
            {col.label}
          </motion.h2>
          {look ? (
            <div className={look.className}>
              {col.items.map((item) => (
                <look.Dish
                  key={String(item.id)}
                  scroller={scroller}
                  item={item}
                  onOpen={open}
                  onQuickAdd={quickAdd}
                />
              ))}
            </div>
          ) : (
            <div className='grid grid-cols-3 gap-2.5'>
              {col.items.map((item) => (
                <ZoomTile
                  key={String(item.id)}
                  item={item}
                  onOpen={open}
                  onQuickAdd={quickAdd}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </motion.div>
  )
})

/** Where the scroller's room starts under the top bar, px: its top padding */
function roomTop(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).paddingTop) || 0
}
