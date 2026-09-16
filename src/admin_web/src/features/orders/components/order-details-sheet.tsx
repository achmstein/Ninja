import { useQuery } from '@tanstack/react-query'
import { Check, Coffee, MessageSquare, X } from 'lucide-react'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { formatEgp, getOrderStatus, isSubmitted } from '../status'

type OrderDetailsSheetProps = {
  orderId: number | null
  onOpenChange: (open: boolean) => void
  onConfirm: (orderNumber: number) => void
  onCancel: (orderNumber: number) => void
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
              <Badge variant={status.variant} className='gap-1'>
                {StatusIcon && <StatusIcon className='h-3 w-3' />}
                {t(status.key)}
              </Badge>
            )}
          </div>
          <SheetDescription>
            {order?.date ? new Date(order.date).toLocaleString(locale) : ' '}
          </SheetDescription>
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

        {order && isSubmitted(order.status) && orderId != null && (
          <SheetFooter className='flex-row gap-2'>
            <Button
              variant='outline'
              className='flex-1'
              disabled={isActing}
              onClick={() => onCancel(orderId)}
            >
              <X className='me-1 h-4 w-4' />
              {t('cancelOrderButton')}
            </Button>
            <Button
              className='flex-1'
              disabled={isActing}
              onClick={() => onConfirm(orderId)}
            >
              {isActing ? (
                <Spinner className='me-1' />
              ) : (
                <Check className='me-1 h-4 w-4' />
              )}
              {t('confirmOrder')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
