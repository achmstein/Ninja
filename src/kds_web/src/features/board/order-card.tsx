import {
  Armchair,
  Check,
  DoorOpen,
  MessageSquareText,
  Play,
  ShoppingBag,
  Store,
  Undo2,
} from 'lucide-react'
import type { KitchenOrder } from '@/api/ordering/types.gen'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  formatElapsed,
  orderUrgency,
  urgencyBorderClass,
  urgencyTextClass,
} from './status'

/**
 * One order as the kitchen sees it: the number and the clock at the top,
 * where it goes and for whom, the lines big enough to read from a metre
 * away, and the one or two taps that move it along. Nothing about money.
 */
export function OrderCard({
  order,
  nowMs,
  isActing,
  onStart,
  onReady,
  onRecall,
}: {
  order: KitchenOrder
  nowMs: number
  isActing: boolean
  onStart: () => void
  onReady: () => void
  onRecall: () => void
}) {
  const t = useT()
  const localized = useLocalized()

  const isReady = order.preparation === 'Ready'
  const isPreparing = order.preparation === 'Preparing'

  // The clock runs from confirmation — the moment the order reached the
  // kitchen — and stops on Ready, where it becomes "how long ago"
  const since = order.confirmedAt ?? order.date
  const urgency = isReady ? 'fresh' : orderUrgency(since, nowMs)
  const clock = isReady
    ? formatElapsed(order.readyAt, nowMs)
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
        'gap-3 border-2 py-4',
        urgencyBorderClass(urgency),
        isReady && 'border-emerald-500/60'
      )}
    >
      <CardHeader className='px-4'>
        <CardTitle className='text-2xl font-bold tabular-nums'>
          #{Number(order.orderNumber)}
        </CardTitle>
        <CardAction
          className={cn(
            'text-xl font-semibold tabular-nums',
            isReady
              ? 'text-emerald-600 dark:text-emerald-500'
              : urgencyTextClass(urgency)
          )}
        >
          {clock}
        </CardAction>
        <CardDescription className='text-foreground flex items-center gap-2 text-base'>
          <PlaceIcon className='text-muted-foreground size-5 shrink-0' />
          <span className='truncate font-semibold'>{destination}</span>
          {who && (
            <span className='text-muted-foreground truncate'>· {who}</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className='flex flex-col gap-3 px-4'>
        <ul className='divide-border divide-y'>
          {(order.items ?? []).map((item, index) => (
            <li key={index} className='flex gap-3 py-2'>
              <span className='w-9 shrink-0 text-xl font-bold tabular-nums'>
                {item.units}×
              </span>
              <div className='min-w-0 flex-1'>
                <div className='text-lg leading-tight font-semibold'>
                  {localized(item.productName)}
                </div>
                {item.customizationsDescription && (
                  <div className='text-muted-foreground mt-0.5 text-base'>
                    {localized(item.customizationsDescription)}
                  </div>
                )}
                {item.specialInstructions && (
                  <div className='mt-0.5 text-base font-medium text-amber-600 dark:text-amber-500'>
                    {item.specialInstructions}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {order.customerNote && (
          <Alert className='border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'>
            <MessageSquareText />
            <AlertDescription className='text-base font-medium text-inherit'>
              {order.customerNote}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className='gap-2 px-4'>
        {isReady ? (
          <Button
            variant='outline'
            className='h-14 flex-1 gap-2 text-lg'
            disabled={isActing}
            onClick={onRecall}
          >
            <Undo2 className='size-6' />
            {t('recall')}
          </Button>
        ) : (
          <>
            {!isPreparing && (
              <Button
                variant='secondary'
                className='h-14 flex-1 gap-2 text-lg'
                disabled={isActing}
                onClick={onStart}
              >
                <Play className='size-6' />
                {t('start')}
              </Button>
            )}
            <Button
              className='h-14 flex-1 gap-2 text-lg'
              disabled={isActing}
              onClick={onReady}
            >
              <Check className='size-6' />
              {t('ready')}
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  )
}
