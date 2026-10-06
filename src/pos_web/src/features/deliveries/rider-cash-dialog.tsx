import { useMemo, useState } from 'react'
import { Banknote, CheckSquare, Square } from 'lucide-react'
import { NumericKeypad } from '@/components/numeric-keypad'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useT } from '@/lib/i18n'
import { toNumber, useMoney } from '@/lib/money'
import { cn } from '@/lib/utils'
import { splitCounted, type RiderGroup } from './delivery-board'
import type { BoardDelivery } from './use-deliveries'

/** What the keypad shows for an amount: no trailing ".00" */
const plain = (v: number) => {
  const fixed = v.toFixed(2)
  return fixed.endsWith('.00') ? fixed.slice(0, -3) : fixed
}

/**
 * A rider back at the till with the cash for their deliveries: every one
 * still owing is listed and ticked, the cashier counts the cash on the
 * keypad (it starts at what the ticked bills come to), and one tap takes it
 * all in. A delivery the rider is not settling now is unticked. When the
 * count is off, the difference is said and put on the delivery the cashier
 * picks; a short bill stays open at the till, as one delivery's does.
 */
export function RiderCashDialog({
  rider,
  busy,
  onOpenChange,
  onTake,
}: {
  rider: RiderGroup<BoardDelivery> | null
  busy: boolean
  onOpenChange: (open: boolean) => void
  onTake: (amounts: Map<number, number>) => void
}) {
  return (
    <Dialog open={rider != null} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-3xl'>
        {rider && <Body key={rider.riderUserId ?? ''} rider={rider} busy={busy} cancel={() => onOpenChange(false)} onTake={onTake} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({
  rider,
  busy,
  cancel,
  onTake,
}: {
  rider: RiderGroup<BoardDelivery>
  busy: boolean
  cancel: () => void
  onTake: (amounts: Map<number, number>) => void
}) {
  const t = useT()
  const money = useMoney()
  const bills = useMemo(
    () =>
      rider.orders.map((o) => ({
        orderNumber: toNumber(o.orderNumber),
        total: toNumber(o.total),
        order: o,
      })),
    [rider],
  )
  const [ticked, setTicked] = useState(() => new Set(bills.map((b) => b.orderNumber)))
  const [typed, setTyped] = useState<string | null>(null)
  const [differenceOn, setDifferenceOn] = useState<number | null>(null)

  const chosen = bills.filter((b) => ticked.has(b.orderNumber))
  const expected = chosen.reduce((sum, b) => sum + b.total, 0)
  // Until the cashier types, the count follows the ticks
  const counted = typed ?? plain(expected)
  const value = counted === '' ? null : Number(counted)
  const difference = value == null || !Number.isFinite(value) ? null : Math.round((value - expected) * 100) / 100
  const on = differenceOn != null && ticked.has(differenceOn) ? differenceOn : (chosen[chosen.length - 1]?.orderNumber ?? null)
  const canTake = chosen.length > 0 && value != null && Number.isFinite(value) && value >= 0 && !busy
  const name = rider.riderName ?? t('deliveryNoRider')

  const toggle = (id: number) =>
    setTicked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <>
      <DialogHeader>
        <DialogTitle className='text-xl'>{t('riderCashTitle', { name })}</DialogTitle>
        <DialogDescription className='text-base tabular-nums'>
          {t('riderOrders', { count: chosen.length })} · {t('riderCashExpected', { amount: money(expected) })}
        </DialogDescription>
      </DialogHeader>

      <div className='grid gap-6 md:grid-cols-[1fr_300px]'>
        <div className='flex flex-col gap-1.5'>
          {bills.map((b) => {
            const on = ticked.has(b.orderNumber)
            const Box = on ? CheckSquare : Square
            return (
              <button
                key={b.orderNumber}
                type='button'
                role='checkbox'
                aria-checked={on}
                onClick={() => toggle(b.orderNumber)}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-xl border px-3 text-start transition-colors',
                  on ? 'bg-secondary border-foreground/30' : 'hover:bg-muted',
                )}
              >
                <Box className={cn('size-5 shrink-0', !on && 'text-muted-foreground')} aria-hidden />
                <span className='text-muted-foreground shrink-0 text-sm tabular-nums'>#{b.orderNumber}</span>
                <span className='min-w-0 flex-1 truncate font-medium'>{b.order.customerName || t('guest')}</span>
                <span className='shrink-0 font-semibold tabular-nums'>{money(b.total)}</span>
              </button>
            )
          })}
          {chosen.length === 0 && <p className='text-destructive mt-1 text-sm'>{t('riderCashNoneTicked')}</p>}
          {/* Off by something: which bill carries it */}
          {difference != null && difference !== 0 && chosen.length > 1 && (
            <div className='mt-2 flex flex-col gap-1.5'>
              <span className='text-muted-foreground text-sm'>{t('riderCashDifferenceOn')}</span>
              <div className='flex flex-wrap gap-1.5' role='radiogroup'>
                {chosen.map((b) => (
                  <Button
                    key={b.orderNumber}
                    size='sm'
                    variant={b.orderNumber === on ? 'default' : 'outline'}
                    role='radio'
                    aria-checked={b.orderNumber === on}
                    className='h-10 tabular-nums'
                    onClick={() => setDifferenceOn(b.orderNumber)}
                  >
                    #{b.orderNumber}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className='flex flex-col gap-3'>
          <div className='grid gap-1.5'>
            <Label htmlFor='rider-cash-counted'>{t('deliveryCashAmount')}</Label>
            <Input
              id='rider-cash-counted'
              readOnly
              inputMode='none'
              value={counted}
              placeholder='0'
              dir='ltr'
              className='h-16 text-end text-4xl font-bold tabular-nums'
              aria-describedby='rider-cash-difference'
            />
          </div>
          <NumericKeypad value={counted} onChange={setTyped} />
          {/* Said in words, never colour alone */}
          <p id='rider-cash-difference' className='min-h-5 text-sm font-semibold' aria-live='polite'>
            {difference == null ? null : difference === 0 ? (
              <span className='text-emerald-700 dark:text-emerald-400'>{t('riderCashExact')}</span>
            ) : (
              <span className='text-amber-700 dark:text-amber-400'>
                {difference < 0
                  ? t('deliveryCashShort', { amount: money(-difference) })
                  : t('deliveryCashOver', { amount: money(difference) })}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className='grid grid-cols-3 gap-2'>
        <Button variant='outline' size='lg' className='h-12' onClick={cancel}>
          {t('cancel')}
        </Button>
        <Button size='lg' className='col-span-2 h-12' disabled={!canTake} onClick={() => onTake(splitCounted(chosen, value ?? 0, on))}>
          <Banknote className='size-5' />
          {t('riderCashTakeIn', { amount: money(value ?? 0) })}
        </Button>
      </div>
    </>
  )
}
