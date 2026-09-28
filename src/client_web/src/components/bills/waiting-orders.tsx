import { useQuery } from '@tanstack/react-query'
import { Loader2, Star, Tag } from 'lucide-react'
import { type Order, type OrderSummary } from '@/api/ordering'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { statusDotClass } from '@/lib/order-status'
import { PlaceIcon, placeKindOf } from '@/lib/places'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SectionLabel } from '@/components/ninja/page/parts'

// Orders not on a bill yet: sent and waiting, or turned down

export function OrderGroup({
  title,
  orders,
}: {
  title: string
  orders: OrderSummary[]
}) {
  if (orders.length === 0) return null
  return (
    <div className='flex flex-col gap-2'>
      <SectionLabel>{title}</SectionLabel>
      <div className='surface divide-border/60 flex flex-col divide-y overflow-hidden rounded-[1.5rem]'>
        {orders.map((order) => (
          <OrderTile key={String(order.orderNumber)} order={order} />
        ))}
      </div>
    </div>
  )
}

/** An order the till has not put on a bill: where it was sent, and what is
 *  in it. The status dot says what the till did. */
function OrderTile({ order }: { order: OrderSummary }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)

  const detailQuery = useQuery(
    getOrderOptions({
      path: { orderId: Number(order.orderNumber) },
      query: { 'api-version': API_VERSION },
    })
  )
  const discount = Number(order.loyaltyDiscount ?? 0)
  const promoDiscount = Number(order.promoDiscount ?? 0)
  const placeName = localized(order.placeName)

  return (
    <div className='flex items-start gap-2.5 px-4 py-3'>
      <span className={cn('mt-1.5 size-2.5 shrink-0 animate-pulse rounded-full motion-reduce:animate-none', statusDotClass(order.status))} />
      <div className='flex min-w-0 flex-1 flex-col gap-1'>
        <div className='text-body font-semibold'>
          {order.date &&
            new Date(order.date).toLocaleTimeString(
              language === 'ar' ? 'ar-EG' : 'en-US',
              { hour: 'numeric', minute: '2-digit' }
            )}
        </div>
        {placeName && (
          <div className='text-muted-foreground flex items-center gap-1 text-caption'>
            <PlaceIcon
              kind={placeKindOf(order.placeKind)}
              className='h-3.5 w-3.5 shrink-0'
            />
            <span className='truncate'>{placeName}</span>
          </div>
        )}
        {detailQuery.isLoading ? (
          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
        ) : detailQuery.isError ? (
          <p className='text-destructive text-caption'>
            {t('failedToLoadDetails')}
          </p>
        ) : (
          detailQuery.data && <OrderItems order={detailQuery.data} />
        )}
      </div>
      <div className='shrink-0 text-end'>
        <div className='text-body font-bold tabular-nums'>
          {price(Number(order.total ?? 0) - discount)}
        </div>
        {promoDiscount > 0 && (
          <div className='flex items-center justify-end gap-0.5 text-caption text-emerald-600 dark:text-emerald-400'>
            <Tag className='h-3 w-3' />
            {price.discount(promoDiscount)}
          </div>
        )}
        {discount > 0 && (
          <div className='flex items-center justify-end gap-0.5 text-caption text-emerald-600 dark:text-emerald-400'>
            <Star className='h-3 w-3 fill-current' />
            {price.discount(discount)}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderItems({ order }: { order: Order }) {
  const t = useT()
  const localized = useLocalized()

  return (
    <div className='flex flex-col gap-1'>
      {(order.orderItems ?? []).map((item, index) => (
        <div key={index}>
          <div className='flex items-baseline gap-1 text-note'>
            <span className='text-muted-foreground'>
              {Number(item.units ?? 0)}x
            </span>
            <span className='min-w-0 flex-1'>
              {localized(item.productName)}
            </span>
          </div>
          {item.customizationsDescription && (
            <p className='text-muted-foreground ms-6 text-caption'>
              {localized(item.customizationsDescription)}
            </p>
          )}
          {item.specialInstructions && (
            <p className='text-muted-foreground ms-6 text-caption italic'>
              "{item.specialInstructions}"
            </p>
          )}
        </div>
      ))}
      {order.customerNote && (
        <p className='text-muted-foreground text-caption'>
          {t('noteWithText', { notes: order.customerNote })}
        </p>
      )}
    </div>
  )
}
