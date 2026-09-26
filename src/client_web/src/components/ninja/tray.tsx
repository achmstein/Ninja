import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { animate, AnimatePresence, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform, type MotionValue, type PanInfo } from 'motion/react'
import { ArrowUp, Check, Loader2, LogIn, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { lineKey, useCart, type CartLine } from '@/lib/cart'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { CheckoutBlock } from '@/lib/order-payload'
import type { OrderDestination } from '@/lib/order-destination'
import type { CheckoutExtras } from '@/lib/use-checkout-extras'
import { TrayExtras } from './tray-extras'
import type { StoredPlace } from '@/stores/place-store'
import { ScanTableButton } from '@/components/places/table-scanner'
import { StillHereCard } from '@/components/places/still-here'
import { HOLD_MS } from './hold'
import { Odometer } from './odometer'
import { HintBubble } from './hint-bubble'
import { DOCK_H, swipeRemoves, traySummary, trayOpensAfterDrag } from './tray-model'
import { useHint, useTimeout } from './use-hint'
import { useHold } from './use-hold'

const SPRING = { type: 'spring', stiffness: 420, damping: 40 } as const

export type TrayOrder = {
  submit: () => Promise<boolean>
  isPending: boolean
  block: CheckoutBlock
  isGuest: boolean
  destination: OrderDestination
  tableUnconfirmed: boolean
  activePlace: StoredPlace | null
}

/**
 * The tray: the order, the top row of the dock (the app's tabs are the row
 * under it, one dark slab). It shows the dishes' photos and a total that
 * rolls; drag it up (or tap it) and it opens into the order, where a line
 * swipes away and steps up or down. The order goes with a press held until
 * the ring fills. The first dish to land lets the order peek out once, with
 * a word on dragging it up.
 *
 * The dock never moves. The order is a sheet that rises out of it: under a
 * finger it follows the finger (and so does the dimming behind it, through
 * `openness`, 0 shut to 1 open), and on release it springs open or back
 * down depending on how far and how fast it was pulled.
 */
export function Tray({
  targetRef,
  bump,
  expanded,
  onExpandedChange,
  openness,
  canOrder,
  order,
  extras,
  cloudKitchen,
  onSignIn,
  onKeepHolding,
}: {
  /** Where a flying photo lands */
  targetRef: RefObject<HTMLDivElement | null>
  /** Goes up by one each time a photo lands, to give the tray a nudge */
  bump: number
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  /** How far the order is open, 0 to 1, for the dimming behind it */
  openness: MotionValue<number>
  canOrder: boolean
  order: TrayOrder
  /** The note, the code and the points, set in the open order */
  extras: CheckoutExtras
  cloudKitchen: boolean
  onSignIn: () => void
  /** The hold was let go before the ring closed */
  onKeepHolding: () => void
}) {
  const t = useT()
  const price = usePrice()
  const reduced = useReducedMotion()
  const lines = useCart((s) => s.lines)
  const summary = traySummary(lines)
  const empty = summary.count === 0

  // An empty tray has nothing to open
  useEffect(() => {
    if (empty && expanded) onExpandedChange(false)
  }, [empty, expanded, onExpandedChange])

  // The first dish in: a lift, and how to open the order; opening it is the end of that
  const hint = useHint('tray')
  const { pending: hintPending, show: showHint, done: hintDone } = hint
  useEffect(() => {
    if (bump > 0 && hintPending) showHint()
  }, [bump, hintPending, showHint])
  useEffect(() => {
    if (expanded && hintPending) hintDone()
  }, [expanded, hintPending, hintDone])
  useTimeout(hint.showing, 3200, hint.done)

  // The sheet: mounted while open, opening, closing, peeking or under a finger; y is how far it sits below open
  const [sheetOn, setSheetOn] = useState(false)
  const [peek, setPeek] = useState(false)
  const y = useMotionValue(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const height = useRef(0)
  const dragging = useRef(false)
  useMotionValueEvent(y, 'change', (v) =>
    openness.set(height.current > 0 ? Math.max(0, Math.min(1, 1 - v / height.current)) : 0)
  )

  // Opened from outside a drag (a tap): the sheet mounts, tucked in the dock, and rises
  const [wasExpanded, setWasExpanded] = useState(expanded)
  if (expanded !== wasExpanded) {
    setWasExpanded(expanded)
    if (expanded && !empty) setSheetOn(true)
  }
  // The first dish in: the order peeks out of the dock once and tucks back
  const [wasHinting, setWasHinting] = useState(hint.showing)
  if (hint.showing !== wasHinting) {
    setWasHinting(hint.showing)
    if (hint.showing && !reduced && !expanded && !empty) {
      setPeek(true)
      setSheetOn(true)
    }
  }

  // The dishes' circles: on the way up they leave the dock and fly to their rows; on the way down, back
  const [seats, setSeats] = useState<Seat[]>([])
  const dockRef = useRef<HTMLDivElement>(null)
  const measureSeats = () => {
    const sheet = sheetRef.current
    const dock = dockRef.current
    if (openness.get() <= 0.001 && targetRef.current) thumbsWidth.current = targetRef.current.offsetWidth
    if (!sheet || !dock || reduced) return
    const clip = sheet.parentElement?.getBoundingClientRect()
    const dockThumbs = new Map<string, DOMRect>()
    dock.querySelectorAll<HTMLElement>('[data-thumb]').forEach((el) => dockThumbs.set(el.dataset.thumb ?? '', el.getBoundingClientRect()))
    const stack = dockThumbs.values().next().value as DOMRect | undefined
    const offset = y.get()
    const next: Seat[] = []
    sheet.querySelectorAll<HTMLElement>('[data-seat]').forEach((el) => {
      const key = el.dataset.seat ?? ''
      const r = el.getBoundingClientRect()
      const to = { x: r.left, y: r.top - offset, width: r.width, height: r.height }
      // Only the rows the open sheet shows; the rest are simply there when it is open
      if (clip && to.y + to.height > clip.bottom - 4) return
      const from = dockThumbs.get(key) ?? stack
      if (!from) return
      next.push({ key, from: { x: from.left, y: from.top, width: from.width, height: from.height }, to, src: el.dataset.src || null, label: el.dataset.label ?? '', fromDock: dockThumbs.has(key) })
    })
    setSeats(next)
  }
  // Leaving fully open (a pull on the handle, a tap on the dock): the rows may have scrolled, so measure again
  const wasOpen = useRef(false)
  useMotionValueEvent(openness, 'change', (v) => {
    if (wasOpen.current && v < 0.999) measureSeats()
    wasOpen.current = v >= 0.999
  })
  const dockThumbsShown = useTransform(openness, (v): number => (v <= 0.001 ? 1 : 0))
  // Open, the dock is just the total: the circles' place closes up, the count goes and the total grows into the room
  const thumbsWidth = useRef(0)
  const thumbsSize = useTransform(openness, (v): number | string => (v <= 0.001 || !thumbsWidth.current ? 'auto' : thumbsWidth.current * (1 - v)))
  // A little room past the stack at rest (its +N badge hangs over its end), closing up as the sheet opens
  const thumbsGap = useTransform(openness, (v) => 6 - 18 * v)
  const countOpacity = useTransform(openness, (v) => Math.max(0, 1 - v * 2.5))
  const countHeight = useTransform(openness, (v): number | string => (v <= 0.001 ? 'auto' : 16 * (1 - v)))
  const totalScale = useTransform(openness, (v) => 1 + 0.3 * v)
  const seatShown = useTransform(openness, (v): number => (reduced || v >= 0.999 ? 1 : 0))

  const settle = (to: 'open' | 'shut') => {
    const target = to === 'open' ? 0 : height.current
    const run = reduced ? Promise.resolve(y.jump(target)) : animate(y, target, SPRING)
    void Promise.resolve(run).then(() => {
      if (to === 'shut' && !dragging.current) setSheetOn(false)
    })
  }

  // A freshly mounted sheet starts tucked in the dock: measure it and put it there
  useLayoutEffect(() => {
    if (!sheetOn || !sheetRef.current) return
    height.current = sheetRef.current.offsetHeight
    y.jump(height.current)
    // Where each circle will sit, once the sheet has laid out its rows
    const frame = requestAnimationFrame(() => measureSeats())
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measures once per mount
  }, [sheetOn, y])

  // Then it goes where it is meant to be, unless a finger or the peek has it
  useEffect(() => {
    if (!sheetOn || dragging.current || peek) return
    settle(expanded && !empty ? 'open' : 'shut')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- follows the switch, not every render
  }, [sheetOn, expanded, empty, peek])

  useEffect(() => {
    if (!peek || !sheetOn) return
    const h = height.current
    const run = animate(y, [h, h - 56, h, h - 28, h], { duration: 1.1, ease: 'easeOut', delay: 0.15 })
    void run.then(() => setPeek(false))
    return () => run.stop()
  }, [peek, sheetOn, y])

  // Pulling the dock up, or the open sheet down by its handle
  const pan = {
    start: () => {
      if (empty) return
      dragging.current = true
      if (!sheetOn) setSheetOn(true)
      else if (!expanded) height.current = sheetRef.current?.offsetHeight ?? height.current
    },
    move: (from: 'dock' | 'sheet', info: PanInfo) => {
      if (!dragging.current || !height.current) return
      const base = from === 'dock' && !expanded ? height.current : 0
      y.set(Math.max(0, Math.min(height.current, base + info.offset.y)))
    },
    end: (from: 'dock' | 'sheet', info: PanInfo) => {
      if (!dragging.current) return
      dragging.current = false
      const open = trayOpensAfterDrag(from === 'sheet' || expanded, info.offset.y, info.velocity.y)
      if (open !== expanded) onExpandedChange(open)
      settle(open ? 'open' : 'shut')
    },
  }

  const action = (() => {
    if (!canOrder || empty) return null
    if (order.block === 'table' && !cloudKitchen) return <ScanTableButton className='h-12 rounded-full px-5' />
    if (order.block) {
      return (
        <button type='button' onClick={onSignIn} className='bg-primary text-primary-foreground flex h-12 items-center gap-2 rounded-full px-5 text-sm font-bold'>
          <LogIn className='size-4' />
          {t('signIn')}
        </button>
      )
    }
    return <HoldButton onCommit={order.submit} busy={order.isPending} disabled={order.tableUnconfirmed} onEarly={onKeepHolding} />
  })()

  return (
    <div className='relative z-10 shrink-0' style={{ height: DOCK_H }}>
      <AnimatePresence>
        {hint.showing && !expanded && (
          <div className='absolute inset-x-0 bottom-full z-20 mb-4 flex justify-center'>
            <HintBubble>
              <ArrowUp className='size-3.5' />
              {t('ninjaHintTray')}
            </HintBubble>
          </div>
        )}
      </AnimatePresence>

      {/* The order: a sheet that rises out of the dock, clipped at the dock's top edge so it seems to come from inside it */}
      {sheetOn && !empty && (
        <div
          className='pointer-events-none absolute inset-x-0 overflow-hidden rounded-t-[1.75rem]'
          style={{ bottom: DOCK_H - 28, height: 'min(68svh, 34rem)' }}
        >
          <motion.div
            ref={sheetRef}
            role='dialog'
            aria-label={t('ninjaYourOrder')}
            className='slab pointer-events-auto absolute inset-x-0 bottom-0 flex max-h-full flex-col rounded-t-[1.75rem] pb-7'
            style={{ y }}
          >
            <SheetHandle
              onClose={() => onExpandedChange(false)}
              onPanStart={pan.start}
              onPan={(info) => pan.move('sheet', info)}
              onPanEnd={(info) => pan.end('sheet', info)}
            />
            <SeatShown.Provider value={seatShown}>
              <OrderSheet order={order} extras={extras} cloudKitchen={cloudKitchen} />
            </SeatShown.Provider>
          </motion.div>
        </div>
      )}
      {sheetOn && !empty && !reduced && <SeatFlights seats={seats} openness={openness} />}

      {/* The tray's row of the dock */}
      {/* px-6: the dishes and the total start where a card's name does */}
      <div ref={dockRef} className='absolute inset-0 flex items-center gap-3 ps-6 pe-3'>
              <motion.button
                type='button'
                // The dock pulls the order up; a tap opens it too
                onPanStart={pan.start}
                onPan={(_, info) => pan.move('dock', info)}
                onPanEnd={(_, info) => pan.end('dock', info)}
                onTap={() => !empty && onExpandedChange(!expanded)}
                aria-expanded={expanded}
                aria-label={t('ninjaYourOrder')}
                disabled={empty}
                className='flex min-w-0 flex-1 touch-none items-center gap-3 text-start'
              >
                {/* The dock's grab handle; the open sheet has its own */}
                <motion.span
                  aria-hidden
                  className='bg-background/30 absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full'
                  animate={{ opacity: expanded || empty ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                />
                <motion.div
                  ref={targetRef}
                  key={bump}
                  initial={bump > 0 && !reduced ? { scale: 1.18 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                  className='relative flex h-11 min-w-11 shrink-0 items-center'
                  style={reduced ? undefined : { width: thumbsSize, minWidth: thumbsSize, marginInlineEnd: thumbsGap }}
                >
                  {empty ? (
                    <span className='border-background/30 grid size-11 place-items-center rounded-full border border-dashed'>
                      <ShoppingBag className='size-4 opacity-60' />
                    </span>
                  ) : (
                    <Thumbs summary={summary} shown={reduced ? (expanded ? 0 : 1) : dockThumbsShown} />
                  )}
                </motion.div>
                <span className='min-w-0 flex-1'>
                  {empty ? (
                    <span className='line-clamp-2 text-xs leading-snug opacity-70'>{t('ninjaEmptyTray')}</span>
                  ) : (
                    <>
                      <motion.span
                        className='block overflow-hidden text-xs opacity-70'
                        style={reduced ? undefined : { opacity: countOpacity, height: countHeight }}
                      >
                        {t('itemCount', { count: summary.count })}
                      </motion.span>
                      <motion.span
                        className='block origin-[0%_50%] rtl:origin-[100%_50%]'
                        style={reduced ? undefined : { scale: totalScale }}
                      >
                        <Odometer value={price(extras.total)} className='text-base font-bold' />
                      </motion.span>
                      {/* What the code and the points take off, under the total they took it from */}
                      <AnimatePresence initial={false}>
                        {extras.promoDiscount + extras.pointsDiscount > 0 && (
                          <motion.span
                            key='saved'
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={SPRING}
                            className='block text-[11px] font-semibold text-emerald-400 tabular-nums'
                          >
                            −{price(extras.promoDiscount + extras.pointsDiscount)}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </span>
              </motion.button>
              {action}
      </div>
    </div>
  )
}

function Thumbs({ summary, shown }: { summary: ReturnType<typeof traySummary>; shown: MotionValue<number> | number }) {
  const language = useLanguage((s) => s.language)
  return (
    // space-x is logical in Tailwind v4: it overlaps the right way in Arabic without a reverse
    <motion.span className='relative flex items-center -space-x-3' style={{ opacity: shown }}>
      {summary.thumbs.map((thumb) => (
        <span key={thumb.key} data-thumb={thumb.key} className='bg-background/15 ring-foreground relative size-11 shrink-0 overflow-hidden rounded-full ring-2'>
          {thumb.pictureUrl ? (
            <img src={thumb.pictureUrl} alt='' className='size-full object-cover' draggable={false} />
          ) : (
            <span className='grid size-full place-items-center text-sm font-bold'>{(language === 'ar' && thumb.nameAr ? thumb.nameAr : thumb.name).charAt(0)}</span>
          )}
        </span>
      ))}
      {summary.more > 0 && (
        <span className='bg-primary text-primary-foreground ring-foreground absolute -end-1.5 -bottom-1 z-10 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ring-2'>
          +{summary.more}
        </span>
      )}
    </motion.span>
  )
}

type Seat = {
  key: string
  from: { x: number; y: number; width: number; height: number }
  to: { x: number; y: number; width: number; height: number }
  src: string | null
  label: string
  /** Its own circle in the dock; the others come out from behind the stack */
  fromDock: boolean
}

/** Whether a row's photo shows: only once the sheet is fully open, when its circle has landed on it */
const SeatShown = createContext<MotionValue<number> | number>(1)

/**
 * The circles in flight between the dock and the rows, driven by how far
 * the sheet is open, so they follow a finger and come back the way they went.
 * Visible only between shut and open; at either end the real ones show.
 */
function SeatFlights({ seats, openness }: { seats: Seat[]; openness: MotionValue<number> }) {
  const visible = useTransform(openness, (v): number => (v > 0.001 && v < 0.999 ? 1 : 0))
  return (
    <motion.div aria-hidden className='pointer-events-none fixed inset-0 z-50' style={{ opacity: visible }}>
      {seats.map((seat, i) => (
        <SeatFlight key={seat.key} seat={seat} openness={openness} order={i} count={seats.length} />
      ))}
    </motion.div>
  )
}

function SeatFlight({ seat, openness, order, count }: { seat: Seat; openness: MotionValue<number>; order: number; count: number }) {
  // Each circle leaves a touch after the one below it, so they fan out instead of moving as a block
  const lag = count > 1 ? ((count - 1 - order) / (count - 1)) * 0.25 : 0
  const progress = useTransform(openness, (v) => {
    const t = Math.max(0, Math.min(1, (v - lag) / (1 - lag)))
    return t * t * (3 - 2 * t)
  })
  const { from, to } = seat
  const lerp = (a: number, b: number) => (p: number) => a + (b - a) * p
  const x = useTransform(progress, lerp(from.x, to.x))
  // A small rise in the middle of the flight, the same arc a dish takes into the tray
  const y = useTransform(progress, (p) => lerp(from.y, to.y)(p) - Math.sin(p * Math.PI) * 18)
  const width = useTransform(progress, lerp(from.width, to.width))
  const height = useTransform(progress, lerp(from.height, to.height))
  const opacity = useTransform(progress, (p) => (seat.fromDock ? 1 : Math.min(1, p * 3)))
  return (
    <motion.span
      className='slab ring-foreground absolute top-0 left-0 grid place-items-center overflow-hidden text-sm font-bold shadow-lg ring-2'
      // A circle the whole way, as in the dock and on the row: only its size changes
      style={{ x, y, width, height, borderRadius: '50%', opacity }}
    >
      {seat.src ? <img src={seat.src} alt='' className='size-full object-cover' draggable={false} /> : seat.label}
    </motion.span>
  )
}

function SheetHandle({
  onClose,
  onPanStart,
  onPan,
  onPanEnd,
}: {
  onClose: () => void
  onPanStart: () => void
  onPan: (info: PanInfo) => void
  onPanEnd: (info: PanInfo) => void
}) {
  const t = useT()
  return (
    <motion.button
      type='button'
      aria-label={t('close')}
      onTap={onClose}
      onPanStart={onPanStart}
      onPan={(_, info) => onPan(info)}
      onPanEnd={(_, info) => onPanEnd(info)}
      className='flex h-8 shrink-0 touch-none items-center justify-center'
    >
      <span className='bg-background/30 h-1 w-10 rounded-full' />
    </motion.button>
  )
}

function OrderSheet({ order, extras, cloudKitchen }: { order: TrayOrder; extras: CheckoutExtras; cloudKitchen: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const lines = useCart((s) => s.lines)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex items-baseline justify-between px-5 pb-2'>
        <h2 className='heading text-[calc(1.35rem*var(--heading-scale))]'>{t('ninjaYourOrder')}</h2>
      </div>
      <div className='no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-12'>
        {lines.map((line) => (
          <SwipeLine key={lineKey(line)} line={line} />
        ))}
        {/* The note, a code, points: small pills under the dishes, each opening only when wanted */}
        <div className='mt-3 px-2'>
          <TrayExtras extras={extras} />
        </div>
        <div className='mt-3 flex flex-col gap-2 px-2 text-sm'>
          {order.tableUnconfirmed && order.activePlace ? (
            <div className='text-foreground rounded-2xl'>
              <StillHereCard place={order.activePlace} />
            </div>
          ) : order.destination ? (
            <div className='flex items-center gap-2 opacity-70'>
              <PlaceIcon kind={order.destination.placeKind} className='size-4' />
              {localized(order.destination.name)}
            </div>
          ) : order.block === 'table' ? (
            <p className='opacity-80'>{t(cloudKitchen ? 'signInToOrderPickup' : 'scanTableToOrder')}</p>
          ) : order.block === 'account' ? (
            <p className='opacity-80'>{t('tableOrdersNeedAccount')}</p>
          ) : (
            order.isGuest && (
              <div className='flex items-center gap-2 opacity-70'>
                <ShoppingBag className='size-4' />
                {t(cloudKitchen ? 'orderToCollect' : 'guestOrderToCollect')}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One line of the order: swipe it either way to take it off, or step it up
 * and down. Its photo is the landing place of its circle from the dock.
 */
function SwipeLine({ line }: { line: CartLine }) {
  const t = useT()
  const seatShown = useContext(SeatShown)
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const setQuantity = useCart((s) => s.setQuantity)
  const add = useCart((s) => s.add)
  const x = useMotionValue(0)
  // The red under a line only shows once it moves, so no edge of it leaks round the corners
  const warn = useTransform(x, (v) => Math.min(1, Math.abs(v) / 48))
  const row = useRef<HTMLDivElement>(null)
  const [leaving, setLeaving] = useState(false)
  const key = lineKey(line)
  const name = language === 'ar' && line.nameAr ? line.nameAr : line.nameEn
  const options = line.customizations.map((c) => (language === 'ar' && c.optionNameAr ? c.optionNameAr : c.optionNameEn)).join('، ')

  const remove = (direction: number) => {
    setLeaving(true)
    const width = row.current?.offsetWidth ?? 320
    animate(x, direction * width, { duration: 0.18, ease: 'easeIn' }).then(() => {
      setQuantity(key, 0)
      // Gone with a flick is easy to regret: the toast puts it back
      toast.info(t('ninjaRemoved', { name }), { action: { label: t('ninjaUndo'), onClick: () => add(line) }, duration: 5000 })
    })
  }

  return (
    <motion.div layout='position' transition={SPRING} className='relative overflow-hidden rounded-2xl'>
      <motion.div aria-hidden style={{ opacity: warn }} className='bg-destructive absolute inset-0 flex items-center justify-between px-5 text-white'>
        <Trash2 className='size-5' />
        <Trash2 className='size-5' />
      </motion.div>
      <motion.div
        ref={row}
        style={{ x }}
        drag={leaving ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.9}
        dragSnapToOrigin
        onDragEnd={(_, info) => {
          const width = row.current?.offsetWidth ?? 0
          if (swipeRemoves(info.offset.x, width, info.velocity.x)) remove(Math.sign(info.offset.x || info.velocity.x) || 1)
        }}
        className='bg-foreground relative flex touch-pan-y items-center gap-3 px-2 py-2.5'
      >
        <motion.span
          data-seat={key}
          data-src={line.pictureUrl ?? ''}
          data-label={name.charAt(0)}
          className='bg-background/10 grid size-12 shrink-0 place-items-center overflow-hidden rounded-full text-base font-bold'
          style={{ opacity: seatShown }}
        >
          {line.pictureUrl ? <img src={line.pictureUrl} alt='' className='size-full object-cover' draggable={false} /> : name.charAt(0)}
        </motion.span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-semibold'>{name}</span>
          {options && <span className='block truncate text-xs opacity-60'>{options}</span>}
          {line.specialInstructions && <span className='block truncate text-xs italic opacity-60'>"{line.specialInstructions}"</span>}
          <span className='block text-sm font-bold tabular-nums'>{price(line.price * line.quantity)}</span>
        </span>
        <span className='flex items-center gap-1'>
          <button
            type='button'
            aria-label={line.quantity === 1 ? t('ninjaRemove') : t('ninjaLess')}
            onClick={() => (line.quantity === 1 ? remove(-1) : setQuantity(key, line.quantity - 1))}
            className='bg-background/10 grid size-8 place-items-center rounded-full'
          >
            {line.quantity === 1 ? <Trash2 className='size-3.5' /> : <Minus className='size-3.5' />}
          </button>
          <span className='w-6 text-center text-sm font-bold tabular-nums'>{line.quantity}</span>
          <button
            type='button'
            aria-label={t('ninjaMore')}
            onClick={() => setQuantity(key, line.quantity + 1)}
            className='bg-background/10 grid size-8 place-items-center rounded-full'
          >
            <Plus className='size-3.5' />
          </button>
        </span>
      </motion.div>
    </motion.div>
  )
}

const RING_R = 19
const RING_C = 2 * Math.PI * RING_R

/**
 * Hold to order: press and keep pressing while the ring fills; letting go
 * before it closes cancels, so a brushed thumb never sends an order. Space
 * or Enter held down does the same from a keyboard.
 */
function HoldButton({
  onCommit,
  busy,
  disabled,
  onEarly,
}: {
  onCommit: () => Promise<boolean>
  busy: boolean
  disabled?: boolean
  /** A tap let go before the ring closed */
  onEarly: () => void
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const { phase, press, release, reset } = useHold(onCommit, disabled || busy)
  // A tap that let go too soon: a small shake (and the page says keep holding), rather than nothing
  const [early, setEarly] = useState(0)

  // A failed request lets the customer hold again
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy) reset()
    wasBusy.current = busy
  }, [busy, reset])

  const holding = phase === 'holding'
  const filled = holding || phase === 'committed'
  const letGo = () => {
    if (phase === 'holding') {
      setEarly((n) => n + 1)
      onEarly()
    }
    release()
  }

  return (
    <motion.button
      type='button'
      disabled={disabled}
      aria-label={t('ninjaHoldToOrder')}
      aria-busy={busy}
      style={{ borderRadius: 24 }}
      animate={early > 0 && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.36 }}
      key={early}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        press()
      }}
      onPointerUp={letGo}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          press()
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') letGo()
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'bg-background/12 relative flex h-12 shrink-0 touch-none items-center gap-2 ps-1 pe-5 font-bold select-none transition-[scale] duration-200 disabled:opacity-50 motion-reduce:transition-none [-webkit-touch-callout:none]',
        holding && 'scale-[0.96]'
      )}
    >
      <span className='relative grid size-10 place-items-center'>
        <svg viewBox='0 0 44 44' className='absolute inset-0 size-full -rotate-90 rtl:scale-y-[-1]' aria-hidden>
          <circle cx='22' cy='22' r={RING_R} fill='none' stroke='currentColor' strokeOpacity={0.25} strokeWidth='3' />
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
              strokeDashoffset: filled ? 0 : RING_C,
              transition: holding ? `stroke-dashoffset ${HOLD_MS}ms linear` : 'stroke-dashoffset 220ms ease-out',
            }}
          />
        </svg>
        {busy ? <Loader2 className='size-4 animate-spin' /> : <Check className={cn('size-4 transition-opacity', filled ? 'opacity-100' : 'opacity-60')} strokeWidth={3} />}
      </span>
      <span className='text-sm whitespace-nowrap'>{t('ninjaHoldToOrder')}</span>
    </motion.button>
  )
}
