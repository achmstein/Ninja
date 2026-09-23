import {
  Armchair,
  Check,
  DoorOpen,
  MessageSquareText,
  Printer,
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
import { Skeleton } from '@/components/ui/skeleton'
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
 * - on the pass, the stations it is split between, each ticked when done
 *   (or marked printed, where a printer took it and nobody taps);
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
  showParts = false,
}: {
  order: KitchenOrder
  nowMs: number
  isActing: boolean
  onReady?: () => void
  onBringBack?: () => void
  /** The pass: which stations the order is split between */
  showParts?: boolean
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
  const place = localized(order.placeName)
  const channel = place || (isPos ? t('counter') : t('pickup'))
  const PlaceIcon = !place
    ? isPos
      ? Store
      : ShoppingBag
    : order.placeKind === 'Room'
      ? DoorOpen
      : Armchair

  // Who it is for: the name to call out. A counter sale or a table order
  // without a name needs nobody called, so the line is left out; an app
  // pickup without a name is a guest.
  const who = order.customerName || (isPos || place ? '' : t('walkIn'))

  // One station is the whole order; the split is only worth showing past that
  const parts = showParts && (order.parts ?? []).length > 1 ? order.parts! : []

  return (
    <Card className={cn('gap-0 overflow-hidden py-0', toneBorderClass(tone))}>
      <CardHeader
        // items-stretch: CardHeader's own items-start would shrink each row to
        // its content, and the clock's ms-auto would have nothing to push into
        className={cn('flex flex-col items-stretch gap-1 px-3 py-2', toneBandClass(tone))}
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
              toneClockClass(tone),
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
        {parts.length > 0 && (
          <div className='flex flex-wrap gap-1 pt-0.5'>
            {parts.map((part) => {
              const done = part.readyAt != null
              return (
                <Badge
                  key={String(part.stationId)}
                  variant={done ? 'default' : 'outline'}
                  className={cn(
                    'gap-1 px-2 py-0.5 text-sm font-medium [&>svg]:size-3.5',
                    !done && 'bg-card'
                  )}
                >
                  {part.showsOnScreen ? done && <Check /> : <Printer />}
                  {localized(part.stationName)}
                </Badge>
              )
            })}
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

/**
 * A card-shaped placeholder while the board loads: the header band with the
 * number, the place and the clock, a few item lines and the Ready bar, so
 * the first real card lands where its outline already was.
 */
export function OrderCardSkeleton({ items = 2 }: { items?: number }) {
  return (
    <Card className='gap-0 overflow-hidden py-0'>
      <CardHeader className='bg-muted/40 flex flex-col items-stretch gap-1 px-3 py-2'>
        <div className='flex items-center gap-2'>
          <Skeleton className='h-4 w-10' />
          <Skeleton className='h-6 w-20 rounded-md' />
          <Skeleton className='ms-auto h-5 w-12' />
        </div>
      </CardHeader>
      <CardContent className='flex flex-col border-t px-3 py-1'>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} className='flex gap-2 py-2'>
            <Skeleton className='h-5 w-7 shrink-0' />
            <Skeleton className='h-5 flex-1' />
          </div>
        ))}
      </CardContent>
      <CardFooter className='px-3 pt-1 pb-3'>
        <Skeleton className='h-12 flex-1 rounded-md' />
      </CardFooter>
    </Card>
  )
}
