import {
  Check,
  MessageSquare,
  MoreHorizontal,
  Phone,
  ShieldQuestion,
  User,
  UserX,
  X,
} from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { QueueCard } from '@/components/queue-card'
import { PlaceKindIcon } from '@/features/places/components/place-kind-icon'
import {
  formatEgp,
  orderSourceKeys,
  orderUrgency,
  relativeTime,
  urgencyTextClass,
} from '../status'

type PendingOrderCardProps = {
  summary: OrderSummary
  nowMs: number
  onConfirm: () => void
  /** Opens the confirm dialog; cancelling is never one click */
  onCancel: () => void
  onViewCustomer?: () => void
  /** "Nobody at the table": offered for a guest's order at a place */
  onRejectGuest?: () => void
  isActing: boolean
  /** Inside the place's own panel the place is the heading, not a line */
  hidePlace?: boolean
  className?: string
}

/**
 * One submitted order as a ticket: who, where, what, how much, and the one
 * decision (Confirm). The pending endpoint carries the line items, so the
 * card renders from the summary alone. Shared by the live board, the
 * dashboard and the table sheet.
 */
export function PendingOrderCard({
  summary,
  nowMs,
  onConfirm,
  onCancel,
  onViewCustomer,
  onRejectGuest,
  isActing,
  hidePlace = false,
  className,
}: PendingOrderCardProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const urgency = orderUrgency(summary.date, nowMs)
  const items = summary.items ?? []
  const loyaltyDiscount = Number(summary.loyaltyDiscount ?? 0)
  const sourceKey = summary.source ? orderSourceKeys[summary.source] : undefined
  // A guest at a table: how many orders this device has had confirmed here
  // before. A first-timer is worth a look before the kitchen starts.
  const ordersBefore =
    summary.guestOrdersBefore == null ? null : Number(summary.guestOrdersBefore)
  const isGuestAtPlace = ordersBefore != null && summary.placeId != null

  return (
    <QueueCard urgency={urgency} className={className}>
      {/* Who / when — the age text picks up the urgency colour */}
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <span className='text-lg font-semibold'>#{summary.orderNumber}</span>
          {sourceKey && (
            <Badge variant='outline' className='h-5 px-1.5 text-[11px]'>
              {t(sourceKey)}
            </Badge>
          )}
        </div>
        <span className={`text-xs ${urgencyTextClass(urgency)}`}>
          {relativeTime(summary.date, nowMs, t, locale)}
        </span>
      </div>
      <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
        {summary.userName &&
          (onViewCustomer ? (
            <button
              type='button'
              onClick={onViewCustomer}
              className='hover:text-foreground flex items-center gap-1 underline-offset-2 hover:underline'
            >
              <User className='h-3 w-3' />
              {summary.userName}
            </button>
          ) : (
            <span className='flex items-center gap-1'>
              <User className='h-3 w-3' />
              {summary.userName}
            </span>
          ))}
        {/* A guest has no profile to open, so their number is the only way to
            reach them — put it on the ticket rather than a click away */}
        {summary.guestPhone && (
          <a
            href={`tel:${summary.guestPhone}`}
            dir='ltr'
            className='hover:text-foreground flex items-center gap-1 underline-offset-2 hover:underline'
          >
            <Phone className='h-3 w-3' />
            {summary.guestPhone}
          </a>
        )}
        {!hidePlace && localized(summary.placeName) && (
          <span className='flex items-center gap-1'>
            <PlaceKindIcon kind={summary.placeKind} className='h-3 w-3' />
            {localized(summary.placeName)}
          </span>
        )}
        {ordersBefore != null && (
          <span
            className={cn(
              'flex items-center gap-1',
              ordersBefore === 0 && 'text-amber-600 dark:text-amber-500'
            )}
          >
            <ShieldQuestion className='h-3 w-3' />
            {ordersBefore === 0
              ? t('guestFirstOrderHere')
              : t('guestOrdersBefore', { count: ordersBefore })}
          </span>
        )}
      </div>

      <Separator className='my-3' />

      <div className='space-y-2'>
        {items.map((item, index) => (
          <div key={index} className='text-sm'>
            <div className='flex items-baseline justify-between gap-2'>
              <span className='font-medium'>
                {Number(item.units ?? 0)}× {localized(item.productName)}
              </span>
              <span className='text-muted-foreground shrink-0 tabular-nums'>
                {formatEgp(
                  Number(item.unitPrice ?? 0) * Number(item.units ?? 0)
                )}
              </span>
            </div>
            {localized(item.customizationsDescription) && (
              <div className='text-muted-foreground text-xs'>
                {localized(item.customizationsDescription)}
              </div>
            )}
            {item.specialInstructions && (
              <div className='text-muted-foreground text-xs italic'>
                "{item.specialInstructions}"
              </div>
            )}
          </div>
        ))}
      </div>

      {summary.customerNote && (
        <div className='bg-muted mt-3 flex items-start gap-2 rounded-md p-2 text-sm'>
          <MessageSquare className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
          <span>{summary.customerNote}</span>
        </div>
      )}

      <Separator className='my-3' />

      <div className='space-y-1 text-sm'>
        {loyaltyDiscount > 0 && (
          <div className='text-muted-foreground flex justify-between'>
            <span>
              {t('loyaltyDiscount')} ({Number(summary.pointsToRedeem ?? 0)}{' '}
              {t('points')})
            </span>
            <span className='tabular-nums'>−{formatEgp(loyaltyDiscount)}</span>
          </div>
        )}
        <div className='flex justify-between font-semibold'>
          <span>{t('total')}</span>
          <span className='tabular-nums'>{formatEgp(summary.total)}</span>
        </div>
      </div>

      {/* One primary decision; cancelling hides behind the menu and a confirm */}
      <div className='mt-4 flex gap-2'>
        <Button className='flex-1' disabled={isActing} onClick={onConfirm}>
          <Check className='me-1 h-4 w-4' />
          {t('confirm')}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              disabled={isActing}
              aria-label={t('actions')}
            >
              <MoreHorizontal className='h-4 w-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            {onViewCustomer && (
              <>
                <DropdownMenuItem onClick={onViewCustomer}>
                  <User />
                  {t('viewCustomer')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem variant='destructive' onClick={onCancel}>
              <X />
              {t('cancelOrderButton')}
            </DropdownMenuItem>
            {isGuestAtPlace && onRejectGuest && (
              <DropdownMenuItem variant='destructive' onClick={onRejectGuest}>
                <UserX />
                {t('nobodyAtTheTable')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </QueueCard>
  )
}
