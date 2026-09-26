import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { BellRing, Check, ChefHat, Send, X } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { getOrdersByUserOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useArabicStyle, useLanguage, useLocalized, usePrice } from '@/lib/i18n'
import { island, type IslandFace } from '@/lib/island'
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

/** A stage in the island's colours: waiting on the café, done, or turned down */
const TYPES: Record<PillStage, IslandFace['type']> = {
  sent: 'loading',
  preparing: 'loading',
  ready: 'success',
  paid: 'success',
  cancelled: 'error',
}

/**
 * The order just placed, as the island's live face (lib/island.ts): Sent,
 * Preparing, Ready, the order's number with it, morphing in place at each
 * step. Opened (sileo's own expand) it says where the order is, what was
 * ordered and the total, with the way to the bill. It goes a little after
 * the order is done with. Draws nothing itself; mounted once, in the root
 * layout.
 */
export function OrderPill() {
  const placedAt = useOrderPill((s) => s.placedAt)
  const dismissed = useOrderPill((s) => s.dismissed)
  const setShown = useOrderPill((s) => s.setShown)
  const language = useLanguage((s) => s.language)
  const standard = useArabicStyle((s) => s.standard)
  const localized = useLocalized()
  const price = usePrice()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [now, setNow] = useState(() => Date.now())

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

  // When each stage was first seen (the fetch that brought it), which is what its linger counts from
  const [since, setSince] = useState<{ stage: PillStage; at: number }>({ stage, at: placedAt ?? 0 })
  if (since.stage !== stage) setSince({ stage, at: ordersQuery.dataUpdatedAt || (placedAt ?? 0) })

  const visibility = { placedAt: placedAt ?? 0, order, stageSince: since.at, dismissed: dismissed || placedAt == null, now }
  const visible = following && pillVisible(visibility) && !pathname.startsWith('/pay')

  // Wake once, when the answer could next change: no ticking while idle
  const wakeAt = following ? nextCheck(visibility) : null
  useEffect(() => {
    if (wakeAt == null) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wakeAt - Date.now()) + 50)
    return () => clearTimeout(timer)
  }, [wakeAt])

  // The island says it: the hub need not say it as well
  useEffect(() => {
    setShown(visible ? orderNumber : null, visible)
  }, [visible, orderNumber, setShown])

  // The island's live face follows the order; a change of stage morphs it in place
  const say = (w: Parameters<typeof words>[0]) => words(w, language, standard)
  const items = order?.items ?? []
  const total = order?.total
  const itemsKey = items.map((line) => `${line.units}:${localized(line.productName)}`).join('|')
  useEffect(() => {
    if (!visible) {
      island.live(null)
      return
    }
    const Icon = ICONS[stage]
    island.live({
      type: TYPES[stage],
      title: orderNumber != null ? `${say(STAGE_LABEL[stage])} · #${orderNumber}` : say(STAGE_LABEL[stage]),
      icon: <Icon className='size-4' />,
      description: <OrderDetails note={say(NOTES[stage])} items={items} total={total != null && Number(total) > 0 ? price(total) : null} />,
      button: { title: say(PILL_WORDS.seeBills), onClick: () => void navigate({ to: '/bills' }) },
    })
    // Re-said only when what it says changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stage, orderNumber, itemsKey, total, language, standard])
  useEffect(() => () => island.live(null), [])

  return null
}

/** The island opened: where the order is, what is in it, and what it comes to */
function OrderDetails({ note, items, total }: { note: string; items: NonNullable<OrderSummary['items']>; total: string | null }) {
  const localized = useLocalized()
  return (
    <span className='flex flex-col gap-2 text-start'>
      <span>{note}</span>
      {items.length > 0 && (
        <span className='flex flex-col gap-0.5'>
          {items.slice(0, 4).map((line, i) => (
            <span key={i} className='flex gap-2'>
              <span className='w-6 shrink-0 tabular-nums opacity-60'>{Number(line.units ?? 1)}×</span>
              <span className='min-w-0 truncate'>{localized(line.productName)}</span>
            </span>
          ))}
          {items.length > 4 && <span className='ps-8 opacity-60'>+{items.length - 4}</span>}
        </span>
      )}
      {total && <span className='font-semibold tabular-nums'>{total}</span>}
    </span>
  )
}
