import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { BellRing, Check, ChefHat, Send, X } from 'lucide-react'
import { getOrdersByUserOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useArabicStyle, useLanguage, useLocalized, usePrice } from '@/lib/i18n'
import { blurSwap, duration, ease, fade, spring } from '@/lib/motion'
import {
  CLOCK_SLACK_MS,
  nextCheck,
  PILL_WORDS,
  pickOrder,
  pillVisible,
  STAGE_LABEL,
  stageOf,
  useOrderPill,
  words,
  type PillStage,
} from '@/lib/order-pill'
import { cn } from '@/lib/utils'

/** Shared with the Place order button, which grows into the pill */
export const ORDER_PILL_ID = 'order-pill'

const ICONS: Record<PillStage, typeof Send> = {
  sent: Send,
  preparing: ChefHat,
  ready: BellRing,
  paid: Check,
  cancelled: X,
}

const NOTES = {
  sent: PILL_WORDS.sentNote,
  preparing: PILL_WORDS.preparingNote,
  ready: PILL_WORDS.readyNote,
  paid: PILL_WORDS.paidNote,
  cancelled: PILL_WORDS.cancelledNote,
} as const

/**
 * The order just placed, following the customer around the app as a small
 * pill at the top — like an island: Sent → Preparing → Ready, with the
 * order number. It changes width and words in one spring, never by cutting.
 * A tap opens it into a small card (what was ordered, the total, the way
 * to the bill); it slips away a little after the order is done with, or
 * at once when hidden. Mounted once, in the root layout.
 */
export function OrderPill() {
  const placedAt = useOrderPill((s) => s.placedAt)
  const dismissed = useOrderPill((s) => s.dismissed)
  const dismiss = useOrderPill((s) => s.dismiss)
  const setShown = useOrderPill((s) => s.setShown)
  const reduced = useReducedMotion()
  const language = useLanguage((s) => s.language)
  const standard = useArabicStyle((s) => s.standard)
  const say = (w: Parameters<typeof words>[0]) => words(w, language, standard)
  const localized = useLocalized()
  const price = usePrice()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [expanded, setExpanded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const pillRef = useRef<HTMLDivElement>(null)

  const following = placedAt != null && !dismissed
  const ordersQuery = useQuery({
    ...getOrdersByUserOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: 0,
        pageSize: 10,
        fromDate: new Date((placedAt ?? 0) - CLOCK_SLACK_MS).toISOString(),
      },
    }),
    enabled: following,
    // The hub's OrderStatusChanged refetches this at once; the poll only
    // covers a socket that silently died
    refetchInterval: following ? 8_000 : false,
  })
  const order = following ? pickOrder(ordersQuery.data?.items ?? [], placedAt) : null
  const stage: PillStage = order ? stageOf(order) : 'sent'
  const orderNumber = order?.orderNumber != null ? Number(order.orderNumber) : null

  // When each stage was first seen — the fetch that brought it — which is
  // what its linger counts from
  const [since, setSince] = useState<{ stage: PillStage; at: number }>({ stage, at: placedAt ?? 0 })
  if (since.stage !== stage) setSince({ stage, at: ordersQuery.dataUpdatedAt || (placedAt ?? 0) })

  const visibility = {
    placedAt: placedAt ?? 0,
    order,
    stageSince: since.at,
    dismissed: dismissed || placedAt == null,
    now,
  }
  const visible = following && pillVisible(visibility) && !pathname.startsWith('/pay')

  // Wake once, when the answer could next change — no ticking while idle
  const wakeAt = following ? nextCheck(visibility) : null
  useEffect(() => {
    if (wakeAt == null) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wakeAt - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [wakeAt])

  // The pill says it: the hub need not toast it as well
  useEffect(() => {
    setShown(visible ? orderNumber : null, visible)
  }, [visible, orderNumber, setShown])

  // A tap anywhere else folds the card back into the pill
  useEffect(() => {
    if (!expanded) return
    const close = (event: PointerEvent) => {
      if (!pillRef.current?.contains(event.target as Node)) setExpanded(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [expanded])

  const Icon = ICONS[stage]
  const swap = blurSwap(reduced)
  const layoutTransition = reduced ? fade : spring
  const label = say(STAGE_LABEL[stage])
  const items = order?.items ?? []
  const total = order?.total

  return (
    <div className='pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] z-[60] flex justify-center px-4 md:top-20'>
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={pillRef}
            key='pill'
            layoutId={ORDER_PILL_ID}
            layout
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -8, filter: 'blur(6px)' }}
            transition={{ layout: layoutTransition, default: { duration: duration.base, ease: ease.enter } }}
            style={{ borderRadius: expanded ? 24 : 22 }}
            className={cn(
              'bg-foreground text-background pointer-events-auto overflow-hidden shadow-lg shadow-black/15',
              expanded ? 'w-[min(22rem,calc(100vw-2rem))]' : 'w-auto',
            )}
            data-testid='order-pill'
            data-stage={stage}
          >
            <motion.button
              layout='position'
              type='button'
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-live='polite'
              className='relative flex h-11 w-full items-center gap-2.5 ps-1.5 pe-4 outline-none focus-visible:ring-2 focus-visible:ring-current/40'
            >
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full transition-colors duration-250',
                  stage === 'cancelled'
                    ? 'bg-red-500/90 text-white'
                    : stage === 'sent'
                      ? 'bg-background/15'
                      : 'bg-emerald-500 text-white',
                )}
              >
                <AnimatePresence mode='popLayout' initial={false}>
                  <motion.span key={stage} {...swap} className='grid place-items-center'>
                    <Icon className='size-4' aria-hidden />
                  </motion.span>
                </AnimatePresence>
              </span>
              <AnimatePresence mode='popLayout' initial={false}>
                <motion.span key={stage} {...swap} className='text-sm font-semibold whitespace-nowrap'>
                  {label}
                </motion.span>
              </AnimatePresence>
              {orderNumber != null && (
                <motion.span
                  layout='position'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.6 }}
                  className='ms-auto text-sm tabular-nums whitespace-nowrap'
                >
                  #{orderNumber}
                </motion.span>
              )}
            </motion.button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  key='card'
                  layout='position'
                  initial={{ opacity: 0, filter: reduced ? 'none' : 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, transition: { duration: duration.fast } }}
                  transition={{ duration: duration.base, ease: ease.enter, delay: reduced ? 0 : 0.05 }}
                  className='flex flex-col gap-3 px-4 pt-1 pb-4 text-sm'
                >
                  <p className='text-background/70'>{say(NOTES[stage])}</p>
                  {items.length > 0 && (
                    <ul className='border-background/15 flex flex-col gap-1 border-t pt-3'>
                      {items.slice(0, 4).map((line, i) => (
                        <li key={i} className='flex gap-2'>
                          <span className='text-background/60 w-6 shrink-0 tabular-nums'>{Number(line.units ?? 1)}×</span>
                          <span className='min-w-0 truncate'>{localized(line.productName)}</span>
                        </li>
                      ))}
                      {items.length > 4 && <li className='text-background/60 ps-8'>+{items.length - 4}</li>}
                    </ul>
                  )}
                  {total != null && Number(total) > 0 && (
                    <div className='flex items-baseline justify-between font-semibold tabular-nums'>
                      <span className='text-background/70 font-normal'>
                        {say(PILL_WORDS.order)} #{orderNumber}
                      </span>
                      {price(total)}
                    </div>
                  )}
                  <div className='flex gap-2'>
                    <Link
                      to='/bills'
                      onClick={() => setExpanded(false)}
                      className='bg-background text-foreground flex h-10 flex-1 items-center justify-center rounded-full font-medium'
                    >
                      {say(PILL_WORDS.seeBills)}
                    </Link>
                    <button
                      type='button'
                      onClick={() => {
                        setExpanded(false)
                        dismiss()
                      }}
                      className='border-background/25 h-10 rounded-full border px-4 font-medium'
                    >
                      {say(PILL_WORDS.hide)}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
