import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Coffee, MessageSquare, X } from 'lucide-react'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { StatusChip } from '@/components/status-chip'
import { formatWhen } from '@/lib/when'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ImageWithFallback } from '@/components/image-fallback'
import { PlaceKindIcon } from '@/features/places/components/place-kind-icon'
import {
  defaultPlatformRejectReason,
  formatEgp,
  getOrderStatus,
  isSubmitted,
} from '../status'
import {
  PlatformBadge,
  PlatformHandover,
  PlatformRejectReasonPicker,
} from './platform-badge'

type OrderDetailsSheetProps = {
  orderId: number | null
  onOpenChange: (open: boolean) => void
  onConfirm: (orderNumber: number) => void
  /** A delivery platform's order carries the reason it is turned down for */
  onCancel: (orderNumber: number, platformReason?: string) => void
  isActing: boolean
}

export function OrderDetailsSheet({
  orderId,
  onOpenChange,
  onConfirm,
  onCancel,
  isActing,
}: OrderDetailsSheetProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const { data: order, isLoading } = useQuery({
    ...getOrderOptions({
      path: { orderId: orderId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: orderId != null,
  })

  // A delivery platform's order is turned down for a reason its customer hears
  // (kept with the order it was picked for, so the next order starts afresh)
  const [picked, setPicked] = useState<{ orderId: number | null; reason: string } | null>(null)
  const cancelReason =
    picked?.orderId === orderId ? picked.reason : defaultPlatformRejectReason
  const setCancelReason = (reason: string) => setPicked({ orderId, reason })

  const status = getOrderStatus(order?.status)
  const StatusIcon = status?.icon

  return (
    <Sheet open={orderId != null} onOpenChange={onOpenChange}>
      <SheetContent className='sm:max-w-lg'>
        <SheetHeader>
          <div className='flex items-center gap-2'>
            <SheetTitle>
              {t('orderNumber', { id: String(orderId ?? '') })}
            </SheetTitle>
            {status && (
              <StatusChip tone={status.variant} icon={StatusIcon}>
                {t(status.key)}
              </StatusChip>
            )}
          </div>
          <SheetDescription>
            {order?.date ? formatWhen(order.date, 'dateTime', locale, t) : ' '}
          </SheetDescription>
          {/* What the order comes to, at a glance before its lines */}
          {order && (
            <div className='bg-muted/40 mt-2 grid grid-cols-3 divide-x overflow-hidden rounded-lg text-center rtl:divide-x-reverse'>
              <div className='px-2 py-2'>
                <div className='text-muted-foreground text-[11px]'>
                  {t('total')}
                </div>
                <div className='font-semibold tabular-nums'>
                  {formatEgp(order.total)}
                </div>
              </div>
              <div className='px-2 py-2'>
                <div className='text-muted-foreground text-[11px]'>
                  {t('items')}
                </div>
                <div className='font-semibold tabular-nums'>
                  {(order.orderItems ?? []).reduce(
                    (sum, item) => sum + Number(item.units ?? 0),
                    0
                  )}
                </div>
              </div>
              <div className='px-2 py-2'>
                <div className='text-muted-foreground text-[11px]'>
                  {t('placed')}
                </div>
                <div className='font-semibold tabular-nums'>
                  {formatWhen(order.date, 'relative', locale, t)}
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        <SheetBody>
          {isLoading ? (
            <div className='space-y-3'>
              <Skeleton className='h-5 w-2/3' />
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </div>
          ) : order ? (
            <>
              {order.platform && (
                <div className='flex flex-col gap-2 text-sm'>
                  <PlatformBadge platform={order.platform} />
                  <div className='text-muted-foreground'>
                    <PlatformHandover platform={order.platform} />
                  </div>
                </div>
              )}
              {(localized(order.placeName) || order.customerNote) && (
                <div className='flex flex-col gap-2'>
                  {localized(order.placeName) && (
                    <div className='flex items-center gap-2 text-sm'>
                      <PlaceKindIcon
                        kind={order.placeKind}
                        className='text-muted-foreground h-4 w-4'
                      />
                      <span>{localized(order.placeName)}</span>
                    </div>
                  )}
                  {order.customerNote && (
                    <div className='flex items-start gap-2 text-sm'>
                      <MessageSquare className='text-muted-foreground mt-0.5 h-4 w-4' />
                      <span>{order.customerNote}</span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              <div className='space-y-3'>
                <h4 className='text-sm font-medium'>{t('items')}</h4>
                {(order.orderItems ?? []).map((item, index) => (
                  <div key={index} className='flex items-start gap-3'>
                    <ImageWithFallback
                      src={item.pictureUrl}
                      className='h-12 w-12 shrink-0 rounded-md'
                      fallbackIcon={
                        <Coffee className='text-muted-foreground h-4 w-4' />
                      }
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-baseline justify-between gap-2'>
                        <span className='truncate text-sm font-medium'>
                          {localized(item.productName) || '—'}
                        </span>
                        <span className='text-sm tabular-nums'>
                          {Number(item.units ?? 0)} ×{' '}
                          {formatEgp(item.unitPrice)}
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
                  </div>
                ))}
              </div>

              <Separator />

              <div className='space-y-1 text-sm'>
                {Number(order.loyaltyDiscount ?? 0) > 0 && (
                  <div className='text-muted-foreground flex justify-between'>
                    <span>
                      {t('loyaltyDiscount')} (
                      {Number(order.pointsToRedeem ?? 0)} {t('points')})
                    </span>
                    <span className='tabular-nums'>
                      −{formatEgp(order.loyaltyDiscount)}
                    </span>
                  </div>
                )}
                <div className='flex justify-between font-medium'>
                  <span>{t('total')}</span>
                  <span className='tabular-nums'>{formatEgp(order.total)}</span>
                </div>
              </div>

              {order.rating?.ratingValue != null && (
                <>
                  <Separator />
                  <div className='space-y-1 text-sm'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{t('rating')}</span>
                      <span className='text-amber-500'>
                        {'★'.repeat(Number(order.rating.ratingValue))}
                      </span>
                    </div>
                    {order.rating.comment && (
                      <p className='text-muted-foreground'>
                        "{order.rating.comment}"
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <p className='text-muted-foreground text-sm'>{t('failedToLoad')}</p>
          )}
        </SheetBody>

        {order?.platform && isSubmitted(order.status) && (
          <div className='px-4'>
            <PlatformRejectReasonPicker
              value={cancelReason}
              onChange={setCancelReason}
            />
          </div>
        )}
        {order && isSubmitted(order.status) && orderId != null && (
          <SheetFooter className='flex-row gap-2'>
            <Button
              variant='outline'
              className='flex-1'
              disabled={isActing}
              onClick={() =>
                onCancel(orderId, order.platform ? cancelReason : undefined)
              }
            >
              <X />
              {t('cancelOrderButton')}
            </Button>
            <Button
              className='flex-1'
              disabled={isActing}
              onClick={() => onConfirm(orderId)}
            >
              {isActing ? (
                <Spinner />
              ) : (
                <Check />
              )}
              {t('confirmOrder')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
