import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bike, Check, Coffee, MessageSquare, X } from 'lucide-react'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatAddressLine } from '@/lib/address-line'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatWhen } from '@/lib/when'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EntitySheet } from '@/components/entity-sheet'
import { ImageWithFallback } from '@/components/image-fallback'
import { StatusChip } from '@/components/status-chip'
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
  const [picked, setPicked] = useState<{
    orderId: number | null
    reason: string
  } | null>(null)
  const cancelReason =
    picked?.orderId === orderId ? picked.reason : defaultPlatformRejectReason
  const setCancelReason = (reason: string) => setPicked({ orderId, reason })

  const status = getOrderStatus(order?.status)
  const StatusIcon = status?.icon
  const actionable =
    order != null && isSubmitted(order.status) && orderId != null

  return (
    <EntitySheet
      open={orderId != null}
      onOpenChange={onOpenChange}
      title={t('orderNumber', { id: String(orderId ?? '') })}
      status={
        status && (
          <StatusChip tone={status.variant} icon={StatusIcon}>
            {t(status.key)}
          </StatusChip>
        )
      }
      subtitle={
        order?.date ? formatWhen(order.date, 'dateTime', locale, t) : undefined
      }
      // What the order comes to, at a glance before its lines
      figures={
        order
          ? [
              { label: t('total'), value: formatEgp(order.total) },
              {
                label: t('items'),
                value: (order.orderItems ?? []).reduce(
                  (sum, item) => sum + Number(item.units ?? 0),
                  0
                ),
              },
              {
                label: t('placed'),
                value: formatWhen(order.date, 'relative', locale, t),
              },
            ]
          : undefined
      }
      danger={
        actionable && (
          <Button
            variant='ghost'
            className='text-destructive hover:text-destructive'
            disabled={isActing}
            onClick={() =>
              onCancel(orderId, order.platform ? cancelReason : undefined)
            }
          >
            <X />
            {t('cancelOrderButton')}
          </Button>
        )
      }
      actions={
        actionable && (
          <Button disabled={isActing} onClick={() => onConfirm(orderId)}>
            {isActing ? <Spinner /> : <Check />}
            {t('confirmOrder')}
          </Button>
        )
      }
    >
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
          {order.delivery && (
            <div className='bg-muted/50 flex flex-col gap-1 rounded-lg p-3 text-sm'>
              <div className='flex items-center gap-2 font-medium'>
                <Bike className='text-muted-foreground h-4 w-4' />
                {formatAddressLine(
                  order.delivery,
                  {
                    building: t('deliveryBuildingShort'),
                    floor: t('deliveryFloorShort'),
                    apartment: t('deliveryApartmentShort'),
                  },
                  locale
                )}
              </div>
              {/* It couldn't be delivered, or it came back: said in words */}
              {(order.delivery.failedAt || order.delivery.returnedAt) && (
                <div className='font-medium text-amber-700 dark:text-amber-400'>
                  {order.delivery.returnedAt
                    ? t('deliveryReturnedLabel')
                    : t('deliveryFailedLabel')}
                </div>
              )}
              {order.delivery.directions && (
                <div className='text-muted-foreground italic'>
                  "{order.delivery.directions}"
                </div>
              )}
              <div className='text-muted-foreground flex flex-wrap gap-x-3'>
                <span dir='ltr'>{order.delivery.phone}</span>
                <span>
                  {t('deliveryFee')}: {formatEgp(order.delivery.fee)}
                </span>
                {order.delivery.riderName && (
                  <span>
                    {t('riderRole')}: {order.delivery.riderName}
                  </span>
                )}
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
                      {Number(item.units ?? 0)} × {formatEgp(item.unitPrice)}
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
                  {t('pointsCount', {
                    count: Number(order.pointsToRedeem ?? 0),
                    points: Number(order.pointsToRedeem ?? 0),
                  })}
                  )
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

          {/* The reason a platform's customer hears if it is turned
                  down, picked before Cancel order below */}
          {order.platform && isSubmitted(order.status) && (
            <>
              <Separator />
              <PlatformRejectReasonPicker
                value={cancelReason}
                onChange={setCancelReason}
              />
            </>
          )}
        </>
      ) : (
        <p className='text-muted-foreground text-sm'>{t('failedToLoad')}</p>
      )}
    </EntitySheet>
  )
}
