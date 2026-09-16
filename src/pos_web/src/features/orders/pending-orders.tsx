import { useState } from 'react'
import { Armchair, Check, Clock, DoorOpen, User } from 'lucide-react'
import type { OrderSummary } from '@/api/ordering/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { OrderDetailDialog } from './order-detail-dialog'
import { orderUrgency, relativeTime, urgencyTextClass } from './status'
import { useOrderActions } from './use-order-actions'
import { useNowMs, usePendingOrders } from './use-pending-orders'

function PendingOrderCard({
  order,
  nowMs,
  horizontal,
  isActing,
  onOpen,
  onConfirm,
}: {
  order: OrderSummary
  nowMs: number
  horizontal: boolean
  isActing: boolean
  onOpen: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const money = useMoney()
  const urgency = orderUrgency(order.date, nowMs)

  // Named the way the floor names its tiles: the room or table the order is
  // for, or — for an order with neither — the person who placed it
  const place = localized(order.placeName)
  const who = order.userName || t('guest')
  const title = place || who
  const subtitle = place ? who : order.guestPhone
  const PlaceIcon = !place
    ? User
    : order.placeKind === 'Room'
      ? DoorOpen
      : Armchair

  return (
    <div
      className={cn(
        'bg-card text-card-foreground flex items-center gap-3 rounded-xl border p-3 shadow-xs',
        horizontal && 'w-[320px] shrink-0',
        urgency === 'delayed'
          ? 'border-destructive/70'
          : urgency === 'warning'
            ? 'border-amber-500/70'
            : '',
      )}
    >
      {/* The body opens the items; a separate button confirms, so neither
          tap can be mistaken for the other */}
      <button
        type='button'
        onClick={onOpen}
        className='min-w-0 flex-1 text-start'
      >
        <div className='flex items-center gap-2'>
          <PlaceIcon className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate text-base font-semibold'>{title}</span>
        </div>
        <div className='text-muted-foreground mt-0.5 truncate text-sm'>
          #{toNumber(order.orderNumber)}
          {subtitle && ` · ${subtitle}`}
        </div>
        <div
          className={cn(
            'mt-0.5 text-sm tabular-nums',
            urgencyTextClass(urgency),
          )}
        >
          {relativeTime(order.date, nowMs, t, locale)} · {money(order.total)}
        </div>
      </button>
      <Button
        className='h-12 gap-2 px-4'
        disabled={isActing}
        onClick={onConfirm}
      >
        <Check className='size-5' />
        {t('confirmOrder')}
      </Button>
    </div>
  )
}

/**
 * The queue of customer app orders waiting for a cashier's tap, wherever it
 * is shown: sideways on the floor, stacked on the ticket they will land on.
 * Confirm is right on the card — the usual answer — and the card body opens
 * the items for a look, or a cancel.
 */
export function PendingOrders({
  orders,
  horizontal = false,
}: {
  orders: OrderSummary[]
  horizontal?: boolean
}) {
  const nowMs = useNowMs()
  const { confirm, cancel, actingOrderNumber } = useOrderActions()
  const [openOrder, setOpenOrder] = useState<number | null>(null)

  if (orders.length === 0) return null

  return (
    <>
      <div
        className={cn(
          horizontal
            ? 'flex gap-3 overflow-x-auto pb-1'
            : 'flex flex-col gap-2',
        )}
      >
        {orders.map((order) => {
          const id = toNumber(order.orderNumber)
          return (
            <PendingOrderCard
              key={id}
              order={order}
              nowMs={nowMs}
              horizontal={horizontal}
              isActing={actingOrderNumber === id}
              onOpen={() => setOpenOrder(id)}
              onConfirm={() => confirm(id)}
            />
          )
        })}
      </div>
      <OrderDetailDialog
        orderNumber={openOrder}
        onOpenChange={(open) => {
          if (!open) setOpenOrder(null)
        }}
        onConfirm={(id) => {
          setOpenOrder(null)
          confirm(id)
        }}
        onCancel={(id) => {
          setOpenOrder(null)
          cancel(id)
        }}
      />
    </>
  )
}

/**
 * The floor's strip: heading, count and the queue — and nothing at all when
 * it is empty, so the tiles keep the whole screen on a quiet afternoon.
 */
export function PendingOrdersStrip() {
  const t = useT()
  const { pending } = usePendingOrders()

  if (pending.length === 0) return null

  return (
    <section className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Clock className='size-5 text-amber-600 dark:text-amber-500' />
        <h2 className='text-lg font-semibold'>{t('pendingOrders')}</h2>
        <Badge className='h-6 tabular-nums'>{pending.length}</Badge>
      </div>
      <PendingOrders orders={pending} horizontal />
    </section>
  )
}
