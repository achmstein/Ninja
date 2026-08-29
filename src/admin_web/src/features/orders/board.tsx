import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  CheckCircle2,
  History,
  MapPin,
  MessageSquare,
  X,
} from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import {
  getOrderOptions,
  getPendingOrdersOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { formatEgp } from './status'
import { useOrderActions } from './use-order-actions'

function relativeTime(
  value: string | undefined,
  t: (key: TranslationKey, params?: TranslateParams) => string,
  locale: string
): string {
  if (!value) return ''
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { minutes })
  const hours = Math.round(minutes / 60)
  return hours < 24
    ? t('hoursAgo', { hours })
    : new Date(value).toLocaleDateString(locale)
}

/**
 * The live queue: every submitted order with its full contents, oldest
 * first. Confirming or cancelling removes the card — an empty queue means
 * all caught up.
 */
export function OrdersBoard() {
  const t = useT()
  const { confirm, cancel, actingOrderNumber } = useOrderActions()

  const pendingQuery = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR is the primary update path; this poll is only a fallback
    refetchInterval: 60_000,
  })

  const pending = [...(pendingQuery.data ?? [])].sort(
    (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
  )

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('orders')}
              </h1>
              {pending.length > 0 && (
                <Badge variant='default' className='h-6 tabular-nums'>
                  {pending.length}
                </Badge>
              )}
            </div>
            <p className='text-muted-foreground'>{t('liveOrdersSubtitle')}</p>
          </div>
          {/* Same IA as Rooms: the page is the live surface, history is an icon away */}
          <Button size='icon' variant='ghost' asChild>
            <Link to='/orders/history' aria-label={t('orderHistory')}>
              <History size={20} className='stroke-muted-foreground' />
            </Link>
          </Button>
        </div>

        {pendingQuery.isLoading ? (
          <div className='grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='h-56' />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-3 py-24 text-center'>
            <CheckCircle2 className='h-12 w-12 text-green-600/50' />
            <p className='text-lg font-medium'>{t('allClear')}</p>
            <p className='text-sm'>{t('newOrdersAppearInstantly')}</p>
          </div>
        ) : (
          <div className='grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {pending.map((order) => (
              <PendingOrderCard
                key={String(order.orderNumber)}
                summary={order}
                onConfirm={() => confirm(Number(order.orderNumber))}
                onCancel={() => cancel(Number(order.orderNumber))}
                // Only the card being acted on shows busy
                isActing={Number(actingOrderNumber) === Number(order.orderNumber)}
              />
            ))}
          </div>
        )}
      </Main>
    </>
  )
}

function PendingOrderCard({
  summary,
  onConfirm,
  onCancel,
  isActing,
}: {
  summary: OrderSummary
  onConfirm: () => void
  onCancel: () => void
  isActing: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const orderId = Number(summary.orderNumber)

  // The summary has no line items; each card loads its full order (cached
  // and invalidated together with the rest of the order queries)
  const { data: order, isLoading } = useQuery(
    getOrderOptions({
      path: { orderId },
      query: { 'api-version': API_VERSION },
    })
  )

  const loyaltyDiscount = Number(order?.loyaltyDiscount ?? summary.loyaltyDiscount ?? 0)

  return (
    <div className='bg-card rounded-lg border p-4 shadow-sm'>
      {/* Who / when */}
      <div className='flex items-baseline justify-between gap-2'>
        <span className='text-lg font-semibold'>#{summary.orderNumber}</span>
        <span className='text-muted-foreground text-xs'>
          {relativeTime(summary.date, t, locale)}
        </span>
      </div>
      <div className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
        {summary.userName && <span>{summary.userName}</span>}
        {localized(summary.roomName) && (
          <span className='flex items-center gap-1'>
            <MapPin className='h-3 w-3' />
            {localized(summary.roomName)}
          </span>
        )}
      </div>

      <Separator className='my-3' />

      {/* Items */}
      {isLoading ? (
        <div className='space-y-2'>
          <Skeleton className='h-4 w-3/4' />
          <Skeleton className='h-4 w-2/3' />
        </div>
      ) : (
        <div className='space-y-2'>
          {(order?.orderItems ?? []).map((item, index) => (
            <div key={index} className='text-sm'>
              <div className='flex items-baseline justify-between gap-2'>
                <span className='font-medium'>
                  {Number(item.units ?? 0)}× {localized(item.productName)}
                </span>
                <span className='text-muted-foreground shrink-0 tabular-nums'>
                  {formatEgp(Number(item.unitPrice ?? 0) * Number(item.units ?? 0))}
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
      )}

      {/* Customer note */}
      {order?.customerNote && (
        <div className='bg-muted mt-3 flex items-start gap-2 rounded-md p-2 text-sm'>
          <MessageSquare className='text-muted-foreground mt-0.5 h-4 w-4 shrink-0' />
          <span>{order.customerNote}</span>
        </div>
      )}

      <Separator className='my-3' />

      {/* Totals */}
      <div className='space-y-1 text-sm'>
        {loyaltyDiscount > 0 && (
          <div className='text-muted-foreground flex justify-between'>
            <span>
              {t('loyaltyDiscount')} (
              {Number(order?.pointsToRedeem ?? summary.pointsToRedeem ?? 0)}{' '}
              {t('points')})
            </span>
            <span className='tabular-nums'>−{formatEgp(loyaltyDiscount)}</span>
          </div>
        )}
        <div className='flex justify-between font-semibold'>
          <span>{t('total')}</span>
          <span className='tabular-nums'>
            {formatEgp(order?.total ?? summary.total)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className='mt-4 flex gap-2'>
        <Button
          size='sm'
          variant='outline'
          className='flex-1'
          disabled={isActing}
          onClick={onCancel}
        >
          <X className='me-1 h-4 w-4' />
          {t('cancel')}
        </Button>
        <Button
          size='sm'
          className='flex-1'
          disabled={isActing}
          onClick={onConfirm}
        >
          <Check className='me-1 h-4 w-4' />
          {t('confirm')}
        </Button>
      </div>
    </div>
  )
}
