import {
  Armchair,
  Check,
  DoorOpen,
  MessageSquareText,
  ShoppingBag,
  Store,
  Undo2,
} from 'lucide-react'
import type { KitchenOrder } from '@/api/ordering/types.gen'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  formatElapsed,
  orderUrgency,
  urgencyBorderClass,
  urgencyTextClass,
} from './status'

/**
 * One order as the kitchen sees it: number, where it goes and the clock on
 * one line, the lines big enough to read at arm's length, and the one tap
 * that moves it along — Ready on the board, Bring back in the history.
 * Nothing about money.
 */
export function OrderCard({
  order,
  nowMs,
  isActing,
  onReady,
  onBringBack,
}: {
  order: KitchenOrder
  nowMs: number
  isActing: boolean
  onReady?: () => void
  onBringBack?: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()

  const isReady = order.readyAt != null

  // The clock runs from confirmation — the moment the order reached the
  // kitchen. A ready order shows when it was finished instead.
  const since = order.confirmedAt ?? order.date
  const urgency = isReady ? 'fresh' : orderUrgency(since, nowMs)
  const clock = isReady
    ? new Date(order.readyAt!).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : formatElapsed(since, nowMs)

  // Where it goes: the room or table it was ordered from; failing that, the
  // counter it was rung up at, or the customer picking it up
  const room = localized(order.roomName)
  const table = localized(order.tableName)
  const destination =
    room || table || (order.source === 'Pos' ? t('counter') : t('pickup'))
  const PlaceIcon = room
    ? DoorOpen
    : table
      ? Armchair
      : order.source === 'Pos'
        ? Store
        : ShoppingBag
  const who = order.customerName || (order.source === 'Pos' ? '' : t('walkIn'))

  return (
    <Card
      className={cn(
        'gap-2 border-2 py-3',
        urgencyBorderClass(urgency),
        isReady && 'border-emerald-500/60'
      )}
    >
      <CardHeader className='flex items-center gap-2 px-3'>
        <span className='text-xl font-bold tabular-nums'>
          #{Number(order.orderNumber)}
        </span>
        <span className='flex min-w-0 flex-1 items-center gap-1.5 text-base'>
          <PlaceIcon className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate font-semibold'>{destination}</span>
          {who && (
            <span className='text-muted-foreground truncate'>· {who}</span>
          )}
        </span>
        <span
          className={cn(
            'shrink-0 text-lg font-semibold tabular-nums',
            isReady
              ? 'text-emerald-600 dark:text-emerald-500'
              : urgencyTextClass(urgency)
          )}
        >
          {clock}
        </span>
      </CardHeader>

      <CardContent className='flex flex-col gap-2 px-3'>
        <ul className='divide-border divide-y'>
          {(order.items ?? []).map((item, index) => (
            <li key={index} className='flex gap-2 py-1.5'>
              <span className='w-7 shrink-0 text-base font-bold tabular-nums'>
                {item.units}×
              </span>
              <div className='min-w-0 flex-1'>
                <div className='text-base leading-tight font-semibold'>
                  {localized(item.productName)}
                </div>
                {item.customizationsDescription && (
                  <div className='text-muted-foreground mt-0.5 text-sm'>
                    {localized(item.customizationsDescription)}
                  </div>
                )}
                {item.specialInstructions && (
                  <div className='mt-0.5 text-sm font-medium text-amber-600 dark:text-amber-500'>
                    {item.specialInstructions}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {order.customerNote && (
          <Alert className='border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400'>
            <MessageSquareText />
            <AlertDescription className='text-sm font-medium text-inherit'>
              {order.customerNote}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {(onReady || onBringBack) && (
        <CardFooter className='px-3'>
          {onBringBack ? (
            <Button
              variant='outline'
              className='h-12 flex-1 gap-2 text-base'
              disabled={isActing}
              onClick={onBringBack}
            >
              <Undo2 className='size-5' />
              {t('bringBack')}
            </Button>
          ) : (
            <Button
              className='h-12 flex-1 gap-2 text-base'
              disabled={isActing}
              onClick={onReady}
            >
              <Check className='size-5' />
              {t('ready')}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
