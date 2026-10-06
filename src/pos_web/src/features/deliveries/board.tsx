import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Banknote, Loader2, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFeatures } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { BOARD_LANES, byLane, byRider, type BoardLane, type RiderGroup } from './delivery-board'
import { DeliveryCard } from './delivery-card'
import { DeliveryOrderDialog } from './delivery-order-dialog'
import { LANE_META } from './lane-meta'
import { RiderCashDialog } from './rider-cash-dialog'
import { useDeliveries, useDeliveryActions, type BoardDelivery } from './use-deliveries'

/**
 * The branch's deliveries on a page of their own, however many there are:
 * four columns, each scrolling on its own (waiting for a rider, with riders,
 * coming back, cash to take in). Riders out and riders owing cash are
 * grouped by rider, and a rider's cash is taken in for all their deliveries
 * at once. On a narrow till one column shows at a time, picked by its chip.
 * A card opens the delivery, as it does anywhere.
 */
export function DeliveriesBoard() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const rtl = useLanguage((s) => s.language) === 'ar'
  const delivering = useFeatures().delivery
  const { deliveries, isLoading } = useDeliveries()
  const actions = useDeliveryActions()
  const [open, setOpen] = useState<number | null>(null)
  const [paying, setPaying] = useState<RiderGroup<BoardDelivery> | null>(null)
  const [picked, setPicked] = useState<BoardLane | null>(null)

  const lanes = byLane(deliveries)
  const total = BOARD_LANES.reduce((sum, lane) => sum + lanes[lane].length, 0)
  // The narrow board opens on the lane the cashier most likely came for
  const shown = picked ?? (['cashDue', 'waiting', 'comingBack'] as const).find((l) => lanes[l].length > 0) ?? 'withRiders'
  // The dialog follows the board, so a move made elsewhere shows in it at once
  const selected = deliveries.find((d) => toNumber(d.orderNumber) === open) ?? null
  const BackIcon = rtl ? ArrowRight : ArrowLeft

  const column = (lane: BoardLane, header: boolean) => (
    <Column
      key={lane}
      lane={lane}
      orders={lanes[lane]}
      header={header}
      onOpen={(id) => setOpen(id)}
      onTakeCash={setPaying}
      busy={actions.busy}
    />
  )

  return (
    <div className='flex h-full min-h-0 flex-col gap-4 p-4'>
      <div className='flex items-center gap-2'>
        <Button variant='ghost' size='icon' className='size-12' onClick={() => navigate({ to: '/' })} aria-label={t('goBack')}>
          <BackIcon className='size-6' />
        </Button>
        <h1 className='text-xl font-bold'>{t('deliveries')}</h1>
        <Badge className='h-6 tabular-nums'>{total}</Badge>
        <Button
          variant='outline'
          size='icon'
          className='ms-auto size-12'
          aria-label={t('refresh')}
          onClick={() =>
            queryClient.invalidateQueries({
              queryKey: [{ _id: 'getDeliveries' }],
            })
          }
        >
          <RefreshCw className='size-5' />
        </Button>
      </div>

      {!delivering ? (
        <p className='text-muted-foreground m-auto'>{t('deliveriesOff')}</p>
      ) : isLoading ? (
        <Loader2 className='text-muted-foreground m-auto size-6 animate-spin' aria-hidden />
      ) : (
        <>
          {/* Four columns where they fit */}
          <div className='hidden min-h-0 flex-1 grid-cols-4 gap-3 lg:grid'>{BOARD_LANES.map((lane) => column(lane, true))}</div>
          {/* One at a time on a narrow till */}
          <div className='flex min-h-0 flex-1 flex-col gap-3 lg:hidden'>
            <div className='flex gap-2 overflow-x-auto pb-1' role='tablist'>
              {BOARD_LANES.map((lane) => {
                const meta = LANE_META[lane]
                const Icon = meta.icon
                return (
                  <Button
                    key={lane}
                    role='tab'
                    aria-selected={lane === shown}
                    variant={lane === shown ? 'default' : 'outline'}
                    className='h-11 shrink-0 tabular-nums'
                    onClick={() => setPicked(lane)}
                  >
                    <Icon className='size-4' />
                    {t(meta.label)} · {lanes[lane].length}
                  </Button>
                )
              })}
            </div>
            {column(shown, false)}
          </div>
        </>
      )}

      <DeliveryOrderDialog order={selected} onOpenChange={(o) => !o && setOpen(null)} />
      <RiderCashDialog
        rider={paying}
        busy={actions.busy}
        onOpenChange={(o) => !o && setPaying(null)}
        onTake={(amounts) => actions.cashInMany(amounts, () => setPaying(null))}
      />
    </div>
  )
}

/** One lane: its heading and count, then its deliveries, scrolling on their own; with riders and cash due by rider */
function Column({
  lane,
  orders,
  header,
  busy,
  onOpen,
  onTakeCash,
}: {
  lane: BoardLane
  orders: BoardDelivery[]
  header: boolean
  busy: boolean
  onOpen: (orderNumber: number) => void
  onTakeCash: (rider: RiderGroup<BoardDelivery>) => void
}) {
  const t = useT()
  const money = useMoney()
  const meta = LANE_META[lane]
  const Icon = meta.icon
  const grouped = lane === 'withRiders' || lane === 'cashDue'
  const card = (order: BoardDelivery) => (
    <DeliveryCard key={toNumber(order.orderNumber)} order={order} onOpen={() => onOpen(toNumber(order.orderNumber))} />
  )

  return (
    <section className='bg-muted/50 flex min-h-0 flex-1 flex-col rounded-2xl' aria-label={t(meta.label)}>
      {header && (
        <div className='flex items-center gap-2 px-3.5 pt-3.5 pb-2.5'>
          <Icon className={cn('size-[18px] shrink-0', meta.ink)} aria-hidden />
          <h2 className='min-w-0 flex-1 truncate font-semibold'>{t(meta.label)}</h2>
          <span
            className={cn(
              'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums',
              orders.length > 0 && meta.tint ? meta.tint : 'bg-background',
            )}
          >
            {orders.length}
          </span>
        </div>
      )}
      {orders.length === 0 ? (
        <p className='text-muted-foreground m-auto p-6 text-sm'>{t('laneEmpty')}</p>
      ) : (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5', !header && 'pt-2.5')}>
          {!grouped
            ? orders.map(card)
            : byRider(orders).map((group) => {
                const name = group.riderName ?? t('deliveryNoRider')
                const owed = group.orders.reduce((sum, o) => sum + toNumber(o.total), 0)
                return (
                  <div key={group.riderUserId ?? ''} className='bg-background flex flex-col gap-2 rounded-xl border p-2.5'>
                    <div className='flex items-center gap-2.5'>
                      <span className='bg-secondary grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold' aria-hidden>
                        {[...name][0]?.toUpperCase()}
                      </span>
                      <span className='min-w-0 flex-1'>
                        <bdi className='block truncate font-semibold'>{name}</bdi>
                        <span className='text-muted-foreground block text-sm tabular-nums'>
                          {t('riderOrders', { count: group.orders.length })}
                          {lane === 'cashDue' && <> · {money(owed)}</>}
                        </span>
                      </span>
                    </div>
                    {lane === 'cashDue' && (
                      <Button className='h-12' disabled={busy} onClick={() => onTakeCash(group)}>
                        <Banknote className='size-5' />
                        {t('riderCashTake')}
                      </Button>
                    )}
                    {group.orders.map(card)}
                  </div>
                )
              })}
        </div>
      )}
    </section>
  )
}
