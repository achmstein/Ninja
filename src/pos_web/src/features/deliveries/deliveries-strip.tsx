import { useState } from 'react'
import { Banknote, Bike, Check, CircleDot, Clock, MapPin, UserRound, X } from 'lucide-react'
import type { DeliveryOrder, RiderView } from '@/api/ordering/types.gen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { relativeTime } from '@/features/orders/status'
import { useNowMs } from '@/features/orders/use-pending-orders'
import { DeliveryDetails, useAddressLine } from './delivery-details'
import { laneOf, useDeliveries, useDeliveryActions, useRiders, type DeliveryLane } from './use-deliveries'

const LANES: DeliveryLane[] = ['waiting', 'withRider', 'cashDue']

/**
 * The branch's deliveries on the floor, by where each one stands: waiting for
 * a rider, with a rider (and whether they have left), delivered with the cash
 * still out. A tap gives one to a rider or takes the cash in. Gone when there
 * is nothing out, so the floor keeps its room on a quiet day.
 */
export function DeliveriesStrip() {
  const t = useT()
  const { deliveries } = useDeliveries()
  const [open, setOpen] = useState<number | null>(null)
  const live = deliveries.filter((d) => laneOf(d) !== 'done')
  if (live.length === 0) return null

  const selected = deliveries.find((d) => toNumber(d.orderNumber) === open) ?? null

  return (
    <section className='flex flex-col gap-2'>
      <div className='flex items-center gap-2'>
        <Bike className='text-primary size-5' />
        <h2 className='text-lg font-semibold'>{t('deliveries')}</h2>
        <Badge className='h-6 tabular-nums'>{live.length}</Badge>
      </div>
      <div className='flex gap-3 overflow-x-auto pb-1'>
        {LANES.flatMap((lane) => live.filter((d) => laneOf(d) === lane)).map((order) => (
          <DeliveryCard key={toNumber(order.orderNumber)} order={order} onOpen={() => setOpen(toNumber(order.orderNumber))} />
        ))}
      </div>
      <DeliveryDialog order={selected} onOpenChange={(o) => !o && setOpen(null)} />
    </section>
  )
}

function DeliveryCard({ order, onOpen }: { order: DeliveryOrder; onOpen: () => void }) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const nowMs = useNowMs()
  const line = useAddressLine()
  const lane = laneOf(order)
  const d = order.delivery!

  return (
    <button
      type='button'
      onClick={onOpen}
      className={cn(
        'bg-card text-card-foreground flex w-[300px] shrink-0 flex-col gap-1 rounded-xl border p-3 text-start shadow-xs',
        lane === 'waiting' && 'border-amber-500/70',
        lane === 'cashDue' && 'border-emerald-500/70',
      )}
    >
      <div className='flex items-center gap-2'>
        <span className='truncate text-base font-semibold'>{order.customerName || t('guest')}</span>
        <span className='text-muted-foreground ms-auto text-sm tabular-nums'>#{toNumber(order.orderNumber)}</span>
      </div>
      <div className='text-muted-foreground flex items-center gap-1.5 truncate text-sm'>
        <MapPin className='size-3.5 shrink-0' />
        <span className='truncate'>{line(d)}</span>
      </div>
      <div className='flex items-center gap-2 text-sm'>
        <StageChip order={order} />
        <span className='text-muted-foreground ms-auto tabular-nums'>
          {relativeTime(order.confirmedAt ?? order.date, nowMs, t, locale)} · {money(order.total)}
        </span>
      </div>
    </button>
  )
}

function StageChip({ order }: { order: DeliveryOrder }) {
  const t = useT()
  const d = order.delivery!
  const lane = laneOf(order)
  if (lane === 'waiting')
    return (
      <span className='flex items-center gap-1 font-medium text-amber-600 dark:text-amber-500'>
        <Clock className='size-3.5' />
        {order.readyAt ? t('deliveryReadyNoRider') : t('deliveryNoRider')}
      </span>
    )
  if (lane === 'cashDue')
    return (
      <span className='flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-500'>
        <Banknote className='size-3.5' />
        {t('deliveryCashWith', { name: d.riderName ?? '' })}
      </span>
    )
  return (
    <span className='flex items-center gap-1 font-medium'>
      {d.outAt ? <Bike className='size-3.5' /> : <CircleDot className='size-3.5' />}
      {d.outAt ? t('deliveryOnTheWayWith', { name: d.riderName ?? '' }) : t('deliveryWith', { name: d.riderName ?? '' })}
    </span>
  )
}

/** One delivery: where it goes and what is in it, who has it, and the cash */
function DeliveryDialog({ order, onOpenChange }: { order: DeliveryOrder | null; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const { assign, unassign, cashIn, busy } = useDeliveryActions()
  const lane = order ? laneOf(order) : null
  const out = !!order?.delivery?.outAt
  const choosing = lane === 'waiting' || (lane === 'withRider' && !out)
  const riders = useRiders(order != null && choosing)
  const id = toNumber(order?.orderNumber)

  return (
    <Dialog open={order != null} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('orderNumber', { id })}</DialogTitle>
          <DialogDescription className='text-base'>
            {order?.customerName || t('guest')} · {money(order?.total)}
          </DialogDescription>
        </DialogHeader>
        {order?.delivery && <DeliveryDetails delivery={order.delivery} />}
        {order && (
          <div className='flex flex-col gap-1 text-sm'>
            {(order.items ?? []).map((item, i) => (
              <span key={i}>
                {toNumber(item.units)}× {localized(item.productName)}
              </span>
            ))}
          </div>
        )}

        {choosing && (
          <div className='flex flex-col gap-2'>
            <span className='text-muted-foreground text-sm font-medium'>{t('deliveryGiveTo')}</span>
            {riders.isLoading ? (
              <Skeleton className='h-12' />
            ) : (riders.data ?? []).length === 0 ? (
              <p className='text-muted-foreground text-sm'>{t('deliveryNoRiders')}</p>
            ) : (
              (riders.data ?? []).map((rider) => (
                <RiderRow
                  key={rider.userId}
                  rider={rider}
                  current={order?.delivery?.riderUserId === rider.userId}
                  disabled={busy}
                  onPick={() => assign(id, rider.userId ?? '', rider.name ?? '')}
                />
              ))
            )}
            {lane === 'withRider' && (
              <Button variant='outline' className='h-11' disabled={busy} onClick={() => unassign(id)}>
                <X className='size-4' />
                {t('deliveryTakeBack')}
              </Button>
            )}
          </div>
        )}

        {lane === 'cashDue' && (
          <Button
            size='lg'
            className='h-12'
            disabled={busy}
            onClick={() => {
              cashIn(id)
              onOpenChange(false)
            }}
          >
            <Banknote className='size-5' />
            {t('deliveryTakeCash', { amount: money(order?.total), name: order?.delivery?.riderName ?? '' })}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}

function RiderRow({ rider, current, disabled, onPick }: { rider: RiderView; current: boolean; disabled: boolean; onPick: () => void }) {
  const t = useT()
  const out = toNumber(rider.out)
  return (
    <button
      type='button'
      disabled={disabled || current}
      onClick={onPick}
      className={cn(
        'flex h-14 items-center gap-3 rounded-lg border px-3 text-start transition-colors',
        current ? 'border-primary bg-primary/5' : 'hover:bg-muted',
        !rider.onDuty && 'opacity-60',
      )}
    >
      <span className='relative'>
        <UserRound className='size-5' />
        <span className={cn('ring-background absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full ring-2', rider.onDuty ? 'bg-emerald-500' : 'bg-muted-foreground')} />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-medium'>{rider.name}</span>
        <span className='text-muted-foreground block text-xs'>
          {rider.onDuty ? (out > 0 ? t('riderOut', { count: out }) : t('riderFree')) : t('riderOffDuty')}
        </span>
      </span>
      {current && <Check className='text-primary size-5' />}
    </button>
  )
}
