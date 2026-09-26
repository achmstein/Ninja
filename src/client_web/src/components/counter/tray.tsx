import { useEffect, useRef, useState, type RefObject } from 'react'
import { Link } from '@tanstack/react-router'
import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { ArrowUp, Check, Loader2, LogIn, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { lineKey, useCart, type CartLine } from '@/lib/cart'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { PlaceIcon } from '@/lib/places'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { CheckoutBlock } from '@/lib/order-payload'
import type { OrderDestination } from '@/lib/order-destination'
import type { StoredPlace } from '@/stores/place-store'
import { ScanTableButton } from '@/components/places/table-scanner'
import { StillHereCard } from '@/components/places/still-here'
import { ORDER_PILL_ID } from '@/components/order-pill'
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
 * the ring fills. The first dish to land lifts it once, with a word on
 * dragging it up.
 */
export function Tray({
  targetRef,
  bump,
  expanded,
  onExpandedChange,
  canOrder,
  order,
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
  canOrder: boolean
  order: TrayOrder
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
              {t('counterHintTray')}
            </HintBubble>
          </div>
        )}
      </AnimatePresence>

      {/* The order, opened: a sheet that rises out of the dock */}
      <AnimatePresence>
        {expanded && !empty && (
          <motion.div
              key='sheet'
              role='dialog'
              aria-label={t('counterYourOrder')}
              className='bg-foreground text-background absolute inset-x-0 flex flex-col rounded-t-[1.75rem]'
              style={{ bottom: DOCK_H - 28, maxHeight: 'min(68svh, 34rem)' }}
              initial={reduced ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { y: '100%', opacity: 0 }}
              transition={SPRING}
            >
              <SheetHandle onClose={() => onExpandedChange(false)} />
              <OrderSheet order={order} cloudKitchen={cloudKitchen} />
            </motion.div>
        )}
      </AnimatePresence>

      {/* The tray's row of the dock */}
      <motion.div
        className='absolute inset-0 flex items-center gap-3 px-3'
        animate={hint.showing && !reduced ? { y: [0, -12, 0, -6, 0] } : { y: 0 }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.15 }}
      >
              <motion.button
                type='button'
                // The dock drags up into the order; a tap opens it too
                drag={empty ? false : 'y'}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={0.35}
                dragSnapToOrigin
                onDragEnd={(_, info) => onExpandedChange(trayOpensAfterDrag(expanded, info.offset.y, info.velocity.y))}
                onTap={() => !empty && onExpandedChange(!expanded)}
                aria-expanded={expanded}
                aria-label={t('counterYourOrder')}
                disabled={empty}
                className='flex min-w-0 flex-1 touch-none items-center gap-3 text-start'
              >
                <span aria-hidden className='bg-background/30 absolute top-1.5 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full' />
                <motion.div
                  ref={targetRef}
                  key={bump}
                  initial={bump > 0 && !reduced ? { scale: 1.18 } : false}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                  className='relative flex h-11 min-w-11 shrink-0 items-center'
                >
                  {empty ? (
                    <span className='border-background/30 grid size-11 place-items-center rounded-full border border-dashed'>
                      <ShoppingBag className='size-4 opacity-60' />
                    </span>
                  ) : (
                    <Thumbs summary={summary} />
                  )}
                </motion.div>
                <span className='min-w-0 flex-1'>
                  {empty ? (
                    <span className='line-clamp-2 text-xs leading-snug opacity-70'>{t('counterEmptyTray')}</span>
                  ) : (
                    <>
                      <span className='block text-xs opacity-70'>{t('itemCount', { count: summary.count })}</span>
                      <Odometer value={price(summary.total)} className='text-base font-bold' />
                    </>
                  )}
                </span>
              </motion.button>
              {action}
      </motion.div>
    </div>
  )
}

function Thumbs({ summary }: { summary: ReturnType<typeof traySummary> }) {
  return (
    <span className='relative flex items-center -space-x-3 rtl:space-x-reverse'>
      {summary.thumbs.map((thumb) => (
        <span key={thumb.key} className='bg-background/15 ring-foreground relative size-11 shrink-0 overflow-hidden rounded-full ring-2'>
          {thumb.pictureUrl ? (
            <img src={thumb.pictureUrl} alt='' className='size-full object-cover' draggable={false} />
          ) : (
            <span className='grid size-full place-items-center text-sm font-bold'>{thumb.name.charAt(0)}</span>
          )}
        </span>
      ))}
      {summary.more > 0 && (
        <span className='bg-primary text-primary-foreground ring-foreground absolute -end-1.5 -bottom-1 z-10 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ring-2'>
          +{summary.more}
        </span>
      )}
    </span>
  )
}

function SheetHandle({ onClose }: { onClose: () => void }) {
  const t = useT()
  return (
    <motion.button
      type='button'
      aria-label={t('close')}
      onTap={onClose}
      onPanEnd={(_, info) => {
        if (!trayOpensAfterDrag(true, info.offset.y, info.velocity.y)) onClose()
      }}
      className='flex h-8 shrink-0 touch-none items-center justify-center'
    >
      <span className='bg-background/30 h-1 w-10 rounded-full' />
    </motion.button>
  )
}

function OrderSheet({ order, cloudKitchen }: { order: TrayOrder; cloudKitchen: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const lines = useCart((s) => s.lines)

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <div className='flex items-baseline justify-between px-5 pb-2'>
        <h2 className='heading text-[calc(1.35rem*var(--heading-scale))]'>{t('counterYourOrder')}</h2>
        <Link to='/cart' className='text-xs font-semibold underline-offset-4 opacity-70 hover:underline'>
          {t('counterMoreAtCheckout')}
        </Link>
      </div>
      <div className='no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-12'>
        {lines.map((line) => (
          <SwipeLine key={lineKey(line)} line={line} />
        ))}
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

/** One line of the order: swipe it either way to take it off, or step it up and down. */
function SwipeLine({ line }: { line: CartLine }) {
  const t = useT()
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
      toast.info(t('counterRemoved', { name }), { action: { label: t('counterUndo'), onClick: () => add(line) }, duration: 5000 })
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
        <span className='bg-background/10 grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl text-base font-bold'>
          {line.pictureUrl ? <img src={line.pictureUrl} alt='' className='size-full object-cover' draggable={false} /> : name.charAt(0)}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-semibold'>{name}</span>
          {options && <span className='block truncate text-xs opacity-60'>{options}</span>}
          {line.specialInstructions && <span className='block truncate text-xs italic opacity-60'>"{line.specialInstructions}"</span>}
          <span className='block text-sm font-bold tabular-nums'>{price(line.price * line.quantity)}</span>
        </span>
        <span className='flex items-center gap-1'>
          <button
            type='button'
            aria-label={line.quantity === 1 ? t('counterRemove') : t('counterLess')}
            onClick={() => (line.quantity === 1 ? remove(-1) : setQuantity(key, line.quantity - 1))}
            className='bg-background/10 grid size-8 place-items-center rounded-full'
          >
            {line.quantity === 1 ? <Trash2 className='size-3.5' /> : <Minus className='size-3.5' />}
          </button>
          <span className='w-6 text-center text-sm font-bold tabular-nums'>{line.quantity}</span>
          <button
            type='button'
            aria-label={t('counterMore')}
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
      aria-label={t('counterHoldToOrder')}
      aria-busy={busy}
      // The order pill grows out of this button once the order lands (as from the cart's)
      layoutId={ORDER_PILL_ID}
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
        'bg-primary text-primary-foreground relative flex h-12 shrink-0 touch-none items-center gap-2 rounded-full ps-1 pe-5 font-bold select-none transition-[scale] duration-200 disabled:opacity-50 motion-reduce:transition-none [-webkit-touch-callout:none]',
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
      <span className='text-sm whitespace-nowrap'>{t('counterHoldToOrder')}</span>
    </motion.button>
  )
}
