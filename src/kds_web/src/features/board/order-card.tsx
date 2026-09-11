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
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import {
  formatElapsed,
  orderUrgency,
  toneBandClass,
  toneBorderClass,
  toneClockClass,
  type CardTone,
} from './status'

/**
 * One order as a kitchen ticket, laid out the way every kitchen display
 * lays one out:
 *
 * - a header band tinted by how late the order is, carrying the clock as
 *   the loudest thing on the card, the ticket number small (it is what the
 *   till says, not what the kitchen shouts), a chip for where the order
 *   goes, and the customer's name on its own line when there is someone
 *   to call;
 * - the lines, big enough to read at arm's length, quantity in its own
 *   column, modifiers under the product, special instructions in amber;
 * - the one tap that moves it along — Ready on the board, Bring back in
 *   the history.
 *
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
  const isPos = order.source === 'Pos'

  // The clock runs from confirmation — the moment the order reached the
  // kitchen. A ready order shows when it was finished instead.
  const since = order.confirmedAt ?? order.date
  const tone: CardTone = isReady ? 'ready' : orderUrgency(since, nowMs)
  const clock = isReady
    ? new Date(order.readyAt!).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : formatElapsed(since, nowMs)

  // Where it goes: the room or table it was ordered from; failing that, the
  // counter it was rung up at, or the pickup shelf
  const place = localized(order.roomName) || localized(order.tableName)
  const channel = place || (isPos ? t('counter') : t('pickup'))
  const PlaceIcon = localized(order.roomName)
    ? DoorOpen
    : place
      ? Armchair
      : isPos
        ? Store
        : ShoppingBag

  // Who it is for: the name to call out. A counter sale or a table order
  // without a name needs nobody called, so the line is left out; an app
  // pickup without a name is a guest.
  const who = order.customerName || (isPos || place ? '' : t('walkIn'))

  return (
    <Card className={cn('gap-0 overflow-hidden py-0', toneBorderClass(tone))}>
      <CardHeader
        className={cn('flex flex-col gap-1 px-3 py-2', toneBandClass(tone))}
      >
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground shrink-0 text-sm font-medium tabular-nums'>
            #{Number(order.orderNumber)}
          </span>
          <Badge
            variant='outline'
            className='bg-card min-w-0 gap-1 px-2 py-0.5 text-sm font-medium [&>svg]:size-3.5'
          >
            <PlaceIcon className='text-muted-foreground' />
            <span className='truncate'>{channel}</span>
          </Badge>
          <span
            className={cn(
              'ms-auto shrink-0 text-xl leading-none font-bold tabular-nums',
              toneClockClass(tone)
            )}
          >
            {clock}
          </span>
        </div>
        {who && (
          <div className='line-clamp-2 text-lg leading-tight font-semibold break-words'>
            {who}
          </div>
        )}
      </CardHeader>

      <CardContent className='flex flex-col gap-2 border-t px-3 py-1'>
        <ul className='divide-border divide-y'>
          {(order.items ?? []).map((item, index) => (
            <li key={index} className='flex gap-2 py-2'>
              <span className='w-7 shrink-0 text-base font-bold tabular-nums'>
                {item.units}×
              </span>
              <div className='min-w-0 flex-1'>
                <div className='text-base leading-tight font-semibold'>
                  {localized(item.productName)}
                </div>
                {item.customizationsDescription && (
                  <div className='text-muted-foreground mt-0.5 text-sm leading-snug'>
                    {localized(item.customizationsDescription)}
                  </div>
                )}
                {item.specialInstructions && (
                  <div className='mt-0.5 text-sm leading-snug font-medium text-amber-700 dark:text-amber-400'>
                    {item.specialInstructions}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        {order.customerNote && (
          <Alert className='mb-1 border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400'>
            <MessageSquareText />
            <AlertDescription className='text-sm font-medium text-inherit'>
              {order.customerNote}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {(onReady || onBringBack) && (
        <CardFooter className='px-3 pt-1 pb-3'>
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
