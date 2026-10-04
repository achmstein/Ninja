import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { OrderSummary } from '@/api/ordering/types.gen'
import { Check, CircleAlert, MessageSquare, RefreshCw, ShieldQuestion, UserX, X } from 'lucide-react'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useMoney, toNumber } from '@/lib/money'
import { PlatformBadge, PlatformHandover, platformRejectReasons } from './platform-badge'
import { DeliveryDetails } from '@/features/deliveries/delivery-details'

type OrderDetailDialogProps = {
  /** The order to show; null keeps the dialog closed. */
  orderNumber: number | null
  /** The queue's row for it: the identity facts the order itself lacks */
  summary?: OrderSummary
  onOpenChange: (open: boolean) => void
  onConfirm: (orderNumber: number) => void
  /** A delivery platform's order carries the reason it is turned down for */
  onCancel: (orderNumber: number, platformReason?: string) => void
  /** "Nobody at the table": cancel, and turn the guest's device away for the day */
  onRejectGuest?: (orderNumber: number) => void
}

/**
 * What the customer actually ordered, for the cashier who wants to look
 * before accepting: every item with its options and instructions, the note,
 * the total. Confirm is the primary action; cancelling takes a second tap,
 * because the customer is told and there is no way back from it.
 */
export function OrderDetailDialog({
  orderNumber,
  onOpenChange,
  summary,
  onConfirm,
  onCancel,
  onRejectGuest,
}: OrderDetailDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const open = orderNumber != null
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState(platformRejectReasons[0].value)

  useEffect(() => {
    if (!open) {
      setCancelling(false)
      setReason(platformRejectReasons[0].value)
    }
  }, [open])

  const { data: order, isLoading, isError, refetch } = useQuery({
    ...getOrderOptions({
      path: { orderId: orderNumber ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: open,
    // A refusal stays a refusal: say so at once rather than retrying it three times
    retry: (count, error) => {
      const status = (error as { status?: number; response?: { status?: number } })?.response?.status
      return !(status != null && status >= 400 && status < 500) && count < 3
    },
  })
  // A failed load says so and offers another try; the order can still be
  // confirmed or cancelled, as it can from the card, since neither needs it
  const failed = !order && isError
  const canAct = !!order || failed

  // A delivery platform's order: from the order once loaded, the queue's row until then
  const platform = order?.platform ?? summary?.platform ?? null
  const loyaltyDiscount = toNumber(order?.loyaltyDiscount)
  const place = localized(order?.placeName)
  const who = order?.guestName || null
  // A guest's order to a place: the one the "nobody there" answer fits
  const guestAtPlace = !!order?.guestName && order?.placeId != null
  // Who this is: account or guest, the phone, and how many orders the
  // device has had confirmed here before
  const ordersBefore =
    summary?.guestOrdersBefore == null
      ? null
      : toNumber(summary.guestOrdersBefore)
  const identity = [
    ordersBefore == null ? t('accountHolder') : t('guest'),
    summary?.guestPhone,
    ordersBefore == null
      ? null
      : ordersBefore === 0
        ? t('guestFirstOrderHere')
        : t('guestOrdersBefore', { count: ordersBefore }),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {t('orderNumber', { id: orderNumber ?? 0 })}
          </DialogTitle>
          {(place || who) && (
            <DialogDescription className='text-base'>
              {[place, who].filter(Boolean).join(' · ')}
            </DialogDescription>
          )}
          {platform ? (
            <div className='flex flex-col gap-1 text-sm'>
              <PlatformBadge platform={platform} />
              <PlatformHandover platform={platform} className='text-muted-foreground' />
            </div>
          ) : summary && (
            <p
              className={cn(
                'flex items-center gap-1.5 text-sm',
                ordersBefore === 0
                  ? 'text-amber-600 dark:text-amber-500'
                  : 'text-muted-foreground',
              )}
            >
              <ShieldQuestion className='size-4 shrink-0' />
              {identity}
            </p>
          )}
        </DialogHeader>

        {failed ? (
          <div className='bg-muted flex items-center gap-2 rounded-lg p-3 text-sm'>
            <CircleAlert className='text-muted-foreground size-5 shrink-0' />
            <span className='flex-1'>{t('orderDetailsFailed')}</span>
            <Button variant='outline' size='sm' onClick={() => refetch()}>
              <RefreshCw className='size-4' />
              {t('retry')}
            </Button>
          </div>
        ) : isLoading || !order ? (
          <div className='flex flex-col gap-2'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-5 w-2/3' />
            <Skeleton className='h-5 w-1/2' />
          </div>
        ) : (
          <>
            <div className='flex flex-col gap-2'>
              {(order.orderItems ?? []).map((item, index) => (
                <div key={index}>
                  <div className='flex items-baseline justify-between gap-3'>
                    <span className='text-base font-medium'>
                      {toNumber(item.units)}× {localized(item.productName)}
                    </span>
                    <span className='text-muted-foreground shrink-0 tabular-nums'>
                      {money(toNumber(item.unitPrice) * toNumber(item.units))}
                    </span>
                  </div>
                  {localized(item.customizationsDescription) && (
                    <div className='text-muted-foreground text-sm'>
                      {localized(item.customizationsDescription)}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <div className='text-muted-foreground text-sm italic'>
                      "{item.specialInstructions}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            {order.delivery && <DeliveryDetails delivery={order.delivery} />}

            {order.customerNote && (
              <div className='bg-muted flex items-start gap-2 rounded-lg p-3 text-sm'>
                <MessageSquare className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                <span>{order.customerNote}</span>
              </div>
            )}

            <Separator />

            <div className='flex flex-col gap-1'>
              {loyaltyDiscount > 0 && (
                <div className='text-muted-foreground flex justify-between text-sm'>
                  <span>{t('loyaltyDiscount')}</span>
                  <span className='tabular-nums'>
                    −{money(loyaltyDiscount)}
                  </span>
                </div>
              )}
              <div className='flex justify-between text-lg font-semibold'>
                <span>{t('total')}</span>
                <span className='tabular-nums'>{money(order.total)}</span>
              </div>
            </div>
          </>
        )}

        {cancelling ? (
          <>
            <p className='text-destructive text-base'>
              {t('cancelOrderConfirm')}
            </p>
            {/* The platform tells its customer why; one tap picks it */}
            {platform && (
              <div className='flex flex-col gap-2'>
                <span className='text-muted-foreground text-sm'>
                  {t('platformRejectReason')}
                </span>
                <div className='flex flex-wrap gap-2'>
                  {platformRejectReasons.map((r) => (
                    <Button
                      key={r.value}
                      type='button'
                      variant={reason === r.value ? 'default' : 'outline'}
                      className='h-10'
                      aria-pressed={reason === r.value}
                      onClick={() => setReason(r.value)}
                    >
                      {t(r.key)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            {/* The two answers side by side, and the stronger one — the
                guest turned away for the day — on its own row, so three
                wide buttons never overflow the dialog */}
            <DialogFooter className='flex-col gap-2 sm:flex-col'>
              <div className='flex justify-end gap-2'>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-12'
                  onClick={() => setCancelling(false)}
                >
                  {t('keepOrder')}
                </Button>
                <Button
                  variant='destructive'
                  size='lg'
                  className='h-12'
                  onClick={() =>
                    orderNumber != null &&
                    onCancel(orderNumber, platform ? reason : undefined)
                  }
                >
                  <X className='size-5' />
                  {t('cancelOrder')}
                </Button>
              </div>
              {guestAtPlace && onRejectGuest && (
                <Button
                  variant='outline'
                  size='lg'
                  className='text-destructive hover:text-destructive h-12 w-full'
                  onClick={() =>
                    orderNumber != null && onRejectGuest(orderNumber)
                  }
                >
                  <UserX className='size-5' />
                  {t('nobodyAtTheTable')}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              size='lg'
              className='text-destructive hover:text-destructive h-12'
              disabled={!canAct}
              onClick={() => setCancelling(true)}
            >
              <X className='size-5' />
              {t('cancelOrder')}
            </Button>
            <Button
              size='lg'
              className='h-12 px-6'
              disabled={!canAct}
              onClick={() => orderNumber != null && onConfirm(orderNumber)}
            >
              <Check className='size-5' />
              {t('confirmOrder')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
