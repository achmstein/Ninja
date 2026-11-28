import { Bike, Check, Printer, ShoppingBag, TriangleAlert, Undo2, X } from 'lucide-react'
import type { KitchenOrder } from '@/api/ordering/types.gen'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatElapsed, orderUrgency, toneBarClass, toneClockClass, type CardTone } from './status'

/** The delivery platforms whose own mark we show; anything else falls back to its name. */
const platformLogos: Record<string, string> = {
  Talabat: `${import.meta.env.BASE_URL}platforms/talabat.svg`,
}

/**
 * One order as a kitchen ticket, in the till's own manner: a flat white
 * ticket under a thin rule, text in sizes and weights, colour only where it
 * means something.
 *
 * - a thin bar across the top and the clock's colour say how late it is;
 * - where it goes is the biggest line (the kitchen sends it there), with the
 *   ticket's number and who to call quiet under it, and the clock opposite;
 * - the lines, big enough to read at arm's length, the count in its own
 *   column, options under the item, what the customer asked for in amber;
 * - the order's note behind an amber rule, and on the pass the stations it
 *   is split between, in words;
 * - the one tap that moves it along: Ready on the board, Bring back in the
 *   history.
 *
 * An order cancelled at the till goes quiet (a dashed outline, its lines
 * struck through) and says so once, in red; it does not turn the whole
 * ticket red. Nothing about money.
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
  // Its bill was voided at the till after the kitchen had it. The card
  // stays, saying so, until whoever was making it clears it: one that just
  // vanished went unnoticed, and the order went on being made
  const isCancelled = order.cancelledAt != null && !isReady
  const isPos = order.source === 'Pos'

  // The clock runs from confirmation — the moment the order reached the
  // kitchen. A ready order shows when it was finished instead.
  const since = order.confirmedAt ?? order.date
  const tone: CardTone = isCancelled
    ? 'cancelled'
    : isReady
      ? 'ready'
      : orderUrgency(since, nowMs)
  const clock = isReady
    ? new Date(order.readyAt!).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : formatElapsed(since, nowMs)

  // Where it goes: the room or table it was ordered from; failing that, the
  // counter it was rung up at, or the pickup shelf
  const place = localized(order.placeName)
  const channel = place || (order.isDelivery ? t('delivery') : isPos ? t('counter') : t('pickup'))
  // Who it is for: the name to call out. A counter sale or a table order
  // without a name needs nobody called, so the line is left out; an app
  // pickup without a name is a guest.
  const who = order.customerName || (isPos || place ? '' : t('walkIn'))

  // A delivery platform's order: its logo and the code its rider asks for,
  // big enough to match the bag to the rider across the pass, and how it leaves
  const platform = order.platform ?? null
  const platformLogo = platform ? platformLogos[platform.name ?? ''] : undefined
  const riderAt = platform?.riderPickupAt
    ? new Date(platform.riderPickupAt).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null
  const handover = !platform
    ? null
    : platform.expedition === 'Pickup'
      ? t('platformCollect')
      : platform.expedition === 'VendorDelivery'
        ? t('platformOwnRider')
        : riderAt
          ? t('platformRiderAt', { time: riderAt })
          : null

  // One station is the whole order; the split is only worth showing past that
  const parts = showParts && (order.parts ?? []).length > 1 ? order.parts! : []

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border',
        isCancelled ? 'border-dashed bg-transparent' : 'bg-card',
      )}
    >
      <div className={cn('h-[5px] shrink-0', toneBarClass(tone))} />

      <header className='flex items-start gap-3 px-4 pt-3 pb-2.5'>
        <div className='min-w-0 flex-1'>
          {platform ? (
            <div className='flex min-w-0 items-center gap-2'>
              {platformLogo ? (
                <img src={platformLogo} alt={platform.name} className='h-5 w-auto shrink-0' />
              ) : (
                <span className='text-base font-semibold'>{platform.name}</span>
              )}
              <span className='truncate font-mono text-[22px] leading-7 font-bold tabular-nums' dir='ltr'>
                {platform.shortCode ?? platform.code}
              </span>
            </div>
          ) : (
            <div className={cn('text-[22px] leading-7 font-bold break-words', isCancelled && 'text-muted-foreground')}>
              {channel}
            </div>
          )}
          <div className='text-muted-foreground line-clamp-2 text-sm leading-5 break-words'>
            {/* The mark keeps the hash before the number in Arabic */}
            <span className='tabular-nums'>
              {'#\u200F'}
              {Number(order.orderNumber)}
            </span>
            {who && <> · {who}</>}
          </div>
        </div>
        <span className={cn('shrink-0 text-[26px] leading-7 font-bold tabular-nums', toneClockClass(tone))}>{clock}</span>
      </header>

      {isCancelled && (
        <div className='text-destructive flex items-center gap-2 px-4 pb-2.5 text-lg leading-6 font-bold'>
          <X className='size-5 shrink-0' />
          {t('orderCancelled')}
        </div>
      )}
      {handover && (
        <div className='flex items-center gap-1.5 px-4 pb-2.5 text-[15px] font-medium'>
          {platform?.expedition === 'Pickup' ? (
            <ShoppingBag className='text-muted-foreground size-4 shrink-0' />
          ) : (
            <Bike className='text-muted-foreground size-4 shrink-0' />
          )}
          {handover}
        </div>
      )}
      {platform?.cancelledAt && (
        <div className='text-destructive flex items-center gap-1.5 px-4 pb-2.5 text-[15px] font-semibold'>
          <TriangleAlert className='size-4 shrink-0' />
          {t('platformCancelled')}
        </div>
      )}

      <ul className={cn('divide-border divide-y border-t px-4', isCancelled && 'opacity-55')}>
        {(order.items ?? []).map((item, index) => (
          <li key={index} className='flex gap-3 py-2.5'>
            <span className={cn('w-9 shrink-0 text-xl leading-[26px] font-bold tabular-nums', isCancelled && 'font-medium line-through')}>
              {item.units}×
            </span>
            <div className='min-w-0 flex-1'>
              <div className={cn('text-[19px] leading-[26px] font-semibold', isCancelled && 'font-medium line-through')}>
                {localized(item.productName)}
              </div>
              {item.customizationsDescription && (
                <div className='text-muted-foreground text-[15px] leading-[22px]'>
                  {localized(item.customizationsDescription)}
                </div>
              )}
              {item.specialInstructions && (
                <div className='text-[15px] leading-[22px] font-semibold text-amber-700 dark:text-amber-400'>
                  {item.specialInstructions}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {order.customerNote && (
        <div className='bg-muted/60 mx-4 mb-3 border-s-[3px] border-amber-500 px-3 py-2 text-[15px] leading-[22px] font-medium'>
          {order.customerNote}
        </div>
      )}

      {parts.length > 0 && (
        // The stations it is split between, in words: the ones still making it stand out, a done one is ticked
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-1.5 px-4 pb-2.5 text-sm'>
          {parts.map((part, index) => {
            const done = part.readyAt != null
            return (
              <span key={String(part.stationId)} className='inline-flex items-center gap-1'>
                {index > 0 && <span aria-hidden>·</span>}
                <span className={cn(!done && part.showsOnScreen && 'text-foreground font-semibold')}>
                  {localized(part.stationName)}
                </span>
                {part.showsOnScreen ? done && <Check className='size-3.5' /> : <Printer className='size-3.5' />}
              </span>
            )
          })}
        </div>
      )}

      {(onReady || onBringBack) && (
        <footer className='mt-auto px-3 pb-3'>
          {onBringBack ? (
            <Button variant='outline' className='h-14 w-full gap-2 text-lg font-semibold' disabled={isActing} onClick={onBringBack}>
              <Undo2 className='size-5' />
              {t('bringBack')}
            </Button>
          ) : isCancelled ? (
            // The same call as Ready: it takes the ticket off this screen
            <Button variant='outline' className='h-14 w-full text-lg font-semibold' disabled={isActing} onClick={onReady}>
              {t('cancelledRemove')}
            </Button>
          ) : (
            <Button className='h-14 w-full text-lg font-semibold' disabled={isActing} onClick={onReady}>
              {t('ready')}
            </Button>
          )}
        </footer>
      )}
    </article>
  )
}

/**
 * A ticket-shaped placeholder while the board loads: the bar, where it goes
 * and the clock, a few lines and the Ready button, so the first real ticket
 * lands where its outline already was.
 */
export function OrderCardSkeleton({ items = 2 }: { items?: number }) {
  return (
    <div className='bg-card flex flex-col overflow-hidden rounded-xl border'>
      <div className='bg-muted h-[5px]' />
      <div className='flex items-start gap-3 px-4 pt-3 pb-2.5'>
        <div className='flex-1 space-y-2'>
          <Skeleton className='h-6 w-28' />
          <Skeleton className='h-4 w-20' />
        </div>
        <Skeleton className='h-7 w-14' />
      </div>
      <div className='divide-y border-t px-4'>
        {Array.from({ length: items }, (_, i) => (
          <div key={i} className='flex gap-3 py-2.5'>
            <Skeleton className='h-6 w-9 shrink-0' />
            <Skeleton className='h-6 flex-1' />
          </div>
        ))}
      </div>
      <div className='px-3 pt-1 pb-3'>
        <Skeleton className='h-14 w-full rounded-md' />
      </div>
    </div>
  )
}
