import { useState } from 'react'
import { AlertTriangle, Banknote, Bike, Check, Undo2, UserRound, X } from 'lucide-react'
import type { RiderView } from '@/api/ordering/types.gen'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { DeliveryDetails, DeliveryFeeRow } from './delivery-details'
import { cashDifference, laneOf } from './delivery-format'
import { useDeliveryActions, useRiders, type BoardDelivery } from './use-deliveries'

/** A step that settles money or can't be undone asks once more before it goes */
type Asking = 'delivered' | 'cash' | 'cancel' | 'failed' | null

/**
 * One delivery: where it goes and what is in it, who has it, and what the till
 * can do next: give it to a rider or take it back, say it left or arrived for
 * a rider whose phone can't, say it couldn't be delivered and then that it is
 * back (and cancel it), or take the cash in, counted.
 */
export function DeliveryOrderDialog({ order, onOpenChange }: { order: BoardDelivery | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={order != null} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        {/* Keyed by the order, so a confirm half-asked for one is never carried to another */}
        {order && <DeliveryOrderBody key={toNumber(order.orderNumber)} order={order} close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DeliveryOrderBody({ order, close }: { order: BoardDelivery; close: () => void }) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const actions = useDeliveryActions()
  const [asking, setAsking] = useState<Asking>(null)
  const [reason, setReason] = useState('')
  const total = toNumber(order.total)
  const [cash, setCash] = useState(String(total))

  const d = order.delivery
  const lane = laneOf(order)
  const out = d.outAt != null
  const choosing = lane === 'waiting' || (lane === 'withRider' && !out)
  const riders = useRiders(choosing)
  const id = toNumber(order.orderNumber)
  const rider = d.riderName ?? ''
  const collected = Number(cash.replace(',', '.'))
  const difference = cashDifference(Number.isFinite(collected) ? collected : null, total)
  const go = (act: () => void, closes = false) => {
    act()
    setAsking(null)
    if (closes) close()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className='text-xl'>{t('orderNumber', { id })}</DialogTitle>
        <DialogDescription className='text-base'>
          {order.customerName || t('guest')} · {money(order.total)}
        </DialogDescription>
      </DialogHeader>
      <DeliveryDetails delivery={d} />
      {d.failureReason && (
        <p className='flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0' aria-hidden />
          {d.failureReason}
        </p>
      )}
      <ul className='flex flex-col gap-1 text-sm'>
        {/* The count and the name apart, so an English dish name in Arabic still reads count first */}
        {(order.items ?? []).map((item, i) => (
          <li key={`${localized(item.productName)}-${i}`} className='flex gap-1.5'>
            <span className='tabular-nums'>{toNumber(item.units)}×</span>
            <span>{localized(item.productName)}</span>
          </li>
        ))}
      </ul>
      {/* What the rider collects, with the fee in it shown */}
      <div className='flex flex-col gap-1 border-t pt-2'>
        <DeliveryFeeRow delivery={d} />
        <div className='flex justify-between font-semibold'>
          <span>{t('total')}</span>
          <span className='tabular-nums'>{money(order.total)}</span>
        </div>
      </div>

      {choosing && (
        <div className='flex flex-col gap-2'>
          <span className='text-muted-foreground text-sm font-medium'>{t('deliveryGiveTo')}</span>
          {riders.isLoading ? (
            <Skeleton className='h-14' />
          ) : (riders.data ?? []).length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('deliveryNoRiders')}</p>
          ) : (
            (riders.data ?? []).map((r) => (
              <RiderRow
                key={r.userId}
                rider={r}
                current={d.riderUserId === r.userId}
                disabled={actions.busy}
                onPick={() => actions.assign(id, r.userId)}
              />
            ))
          )}
          {lane === 'withRider' && (
            <Button variant='outline' className='h-11' disabled={actions.busy} onClick={() => actions.unassign(id)}>
              <X className='size-4' />
              {t('deliveryTakeBack')}
            </Button>
          )}
        </div>
      )}

      {/* For a rider whose phone cannot say it (a flat battery, no app): the
          till says it left, then that it arrived or couldn't be */}
      {lane === 'withRider' && (
        <div className='flex flex-col gap-1.5 border-t pt-3'>
          <span className='text-muted-foreground text-xs'>{t('deliveryForRider', { name: rider })}</span>
          {!out ? (
            <Button variant='outline' className='h-11' disabled={actions.busy} onClick={() => actions.markOut(id)}>
              <Bike className='size-4' />
              {t('deliveryMarkOut')}
            </Button>
          ) : asking === 'delivered' ? (
            <Confirm
              text={t('deliveryDeliveredConfirm', { name: rider })}
              busy={actions.busy}
              onConfirm={() => go(() => actions.markDelivered(id))}
              onCancel={() => setAsking(null)}
            />
          ) : asking === 'failed' ? (
            <div className='flex flex-col gap-2'>
              <Label htmlFor='failure-reason'>{t('deliveryFailureReason')}</Label>
              <Input
                id='failure-reason'
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('deliveryFailureReasonHint')}
                className='h-11'
                maxLength={300}
                autoComplete='off'
              />
              <Confirm busy={actions.busy} onConfirm={() => go(() => actions.markFailed(id, reason))} onCancel={() => setAsking(null)} />
            </div>
          ) : (
            <div className='grid grid-cols-2 gap-2'>
              <Button variant='outline' className='h-11' disabled={actions.busy} onClick={() => setAsking('delivered')}>
                <Check className='size-4' />
                {t('deliveryMarkDelivered')}
              </Button>
              <Button variant='outline' className='h-11' disabled={actions.busy} onClick={() => setAsking('failed')}>
                <AlertTriangle className='size-4' />
                {t('deliveryMarkFailed')}
              </Button>
            </div>
          )}
        </div>
      )}

      {lane === 'failed' && (
        <Button variant='outline' className='h-11' disabled={actions.busy} onClick={() => actions.markReturned(id)}>
          <Undo2 className='size-4' />
          {t('deliveryMarkReturned')}
        </Button>
      )}

      {/* Failed or back, its cash never in: the order can go, nothing charged */}
      {(lane === 'failed' || lane === 'returned') &&
        (asking === 'cancel' ? (
          <Confirm
            text={t('deliveryCancelConfirm')}
            destructive
            busy={actions.busy}
            onConfirm={() => go(() => actions.cancel(id), true)}
            onCancel={() => setAsking(null)}
          />
        ) : (
          <Button variant='outline' className='text-destructive h-11' disabled={actions.busy} onClick={() => setAsking('cancel')}>
            <X className='size-4' />
            {t('deliveryCancelOrder')}
          </Button>
        ))}

      {lane === 'cashDue' && (
        <div className='flex flex-col gap-2 border-t pt-3'>
          <Label htmlFor='cash-collected'>{t('deliveryCashAmount')}</Label>
          <Input
            id='cash-collected'
            value={cash}
            onChange={(e) => setCash(e.target.value)}
            inputMode='decimal'
            dir='ltr'
            className='h-12 text-lg tabular-nums'
            aria-describedby='cash-difference'
            autoComplete='off'
          />
          <p id='cash-difference' className='text-sm' aria-live='polite'>
            {difference != null && difference !== 0 && (
              <span className='text-amber-700 dark:text-amber-400'>
                {difference < 0
                  ? t('deliveryCashShort', { amount: money(-difference) })
                  : t('deliveryCashOver', { amount: money(difference) })}
              </span>
            )}
          </p>
          {asking === 'cash' ? (
            <Confirm
              text={t('deliveryCashConfirm', { amount: money(collected), name: rider })}
              busy={actions.busy}
              onConfirm={() => go(() => actions.cashIn(id, collected), true)}
              onCancel={() => setAsking(null)}
            />
          ) : (
            <Button
              size='lg'
              className='h-12'
              disabled={actions.busy || !Number.isFinite(collected) || collected < 0 || cash.trim() === ''}
              onClick={() => setAsking('cash')}
            >
              <Banknote className='size-5' />
              {t('deliveryTakeCash', { amount: money(Number.isFinite(collected) ? collected : total), name: rider })}
            </Button>
          )}
        </div>
      )}
    </>
  )
}

function Confirm({
  text,
  destructive,
  busy,
  onConfirm,
  onCancel,
}: {
  text?: string
  destructive?: boolean
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const t = useT()
  return (
    <div className='flex flex-col gap-2' role='group'>
      {text && <p className='text-sm font-medium'>{text}</p>}
      <div className='grid grid-cols-2 gap-2'>
        <Button variant='outline' className='h-11' disabled={busy} onClick={onCancel}>
          {t('goBack')}
        </Button>
        <Button variant={destructive ? 'destructive' : 'default'} className='h-11' disabled={busy} onClick={onConfirm} autoFocus>
          {t('confirmAction')}
        </Button>
      </div>
    </div>
  )
}

function RiderRow({
  rider,
  current,
  disabled,
  onPick,
}: {
  rider: RiderView & { userId: string }
  current: boolean
  disabled: boolean
  onPick: () => void
}) {
  const t = useT()
  const out = toNumber(rider.out)
  const status = !rider.signedIn
    ? t('riderNotSignedIn')
    : rider.onDuty
      ? out > 0
        ? t('riderOut', { count: out })
        : t('riderFree')
      : t('riderOffDuty')
  return (
    <button
      type='button'
      disabled={disabled || current}
      onClick={onPick}
      aria-pressed={current}
      className={cn(
        'flex h-14 items-center gap-3 rounded-lg border px-3 text-start transition-colors',
        current ? 'border-primary bg-primary/5' : 'hover:bg-muted',
      )}
    >
      <span className='relative'>
        <UserRound className='size-5' aria-hidden />
        <span
          aria-hidden
          className={cn(
            'ring-background absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full ring-2',
            rider.onDuty ? 'bg-emerald-500' : 'bg-muted-foreground',
          )}
        />
      </span>
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-medium'>{rider.name}</span>
        {/* Off duty or not signed in is said in words, not only by a dot or a fade */}
        <span className={cn('block text-xs', rider.onDuty ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400')}>
          {status}
        </span>
      </span>
      {current && <Check className='text-primary size-5' aria-hidden />}
    </button>
  )
}
