import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Check,
  CheckCircle2,
  Armchair,
  Clock,
  History,
  MapPin,
  MessageSquare,
  Phone,
  User,
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
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { CustomerDetailSheet } from '@/features/customers/components/customer-detail-sheet'
import { customersService } from '@/features/customers/services/customers-service'
import { formatEgp, orderUrgency, relativeTime, urgencyTextClass } from './status'
import { useOrderActions } from './use-order-actions'

/**
 * The live queue: every submitted order with its full contents, oldest
 * first. Confirming or cancelling removes the card — an empty queue means
 * all caught up.
 */
export function OrdersBoard() {
  const t = useT()
  const { confirm, cancel, actingOrderNumber } = useOrderActions()

  // Tapping a card's customer name opens their profile sheet
  const [customerId, setCustomerId] = useState<string | null>(null)
  const customerQuery = useQuery({
    queryKey: ['customers', customerId],
    queryFn: () => customersService.getCustomer(customerId!),
    enabled: !!customerId,
  })

  // Tick every 30s so ages and urgency tiers advance without a refetch
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const pendingQuery = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR is the primary update path; this poll is only a fallback
    refetchInterval: 60_000,
  })

  const pending = [...(pendingQuery.data ?? [])].sort(
    (a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
  )
  const delayedCount = pending.filter(
    (order) => orderUrgency(order.date, nowMs) === 'delayed'
  ).length

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
              {delayedCount > 0 && (
                <Badge variant='destructive' className='h-6 gap-1 tabular-nums'>
                  <Clock className='h-3 w-3' />
                  {delayedCount} {t('delayed')}
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
          <div className='columns-1 gap-4 md:columns-2 xl:columns-3'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='mb-4 h-56 break-inside-avoid' />
            ))}
          </div>
        ) : pending.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-3 py-24 text-center'>
            <CheckCircle2 className='h-12 w-12 text-green-600/50' />
            <p className='text-lg font-medium'>{t('allClear')}</p>
            <p className='text-sm'>{t('newOrdersAppearInstantly')}</p>
          </div>
        ) : (
          // Masonry via CSS columns: cards pack under each other with no
          // row-alignment holes (a tall ticket no longer leaves white space
          // beside it); the queue fills the start column first, KDS-rail style
          <div className='columns-1 gap-4 md:columns-2 xl:columns-3'>
            {pending.map((order) => (
              <PendingOrderCard
                key={String(order.orderNumber)}
                summary={order}
                nowMs={nowMs}
                onConfirm={() => confirm(Number(order.orderNumber))}
                onCancel={() => cancel(Number(order.orderNumber))}
                onViewCustomer={
                  order.userId
                    ? () => setCustomerId(order.userId ?? null)
                    : undefined
                }
                // Only the card being acted on shows busy
                isActing={Number(actingOrderNumber) === Number(order.orderNumber)}
              />
            ))}
          </div>
        )}
      </Main>

      <CustomerDetailSheet
        customer={customerId ? (customerQuery.data ?? null) : null}
        onOpenChange={(open) => {
          if (!open) setCustomerId(null)
        }}
      />
    </>
  )
}

function PendingOrderCard({
  summary,
  nowMs,
  onConfirm,
  onCancel,
  onViewCustomer,
  isActing,
}: {
  summary: OrderSummary
  nowMs: number
  onConfirm: () => void
  onCancel: () => void
  onViewCustomer?: () => void
  isActing: boolean
}) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const orderId = Number(summary.orderNumber)
  const urgency = orderUrgency(summary.date, nowMs)

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
    <div
      // animate-in runs on mount only — refetches reuse existing cards (stable
      // keys), so exactly the newly arrived ticket rises in and catches the eye
      className={`bg-card animate-in fade-in-0 zoom-in-95 slide-in-from-top-4 mb-4 break-inside-avoid rounded-lg border p-4 shadow-sm transition-[border-color,box-shadow] duration-500 ease-out ${
        urgency === 'delayed'
          ? 'border-destructive/70 shadow-[0_0_12px_3px_rgb(239_68_68/0.35)]'
          : urgency === 'warning'
            ? 'border-amber-500/70 shadow-[0_0_10px_2px_rgb(245_158_11/0.25)]'
            : ''
      }`}
    >
      {/* Who / when — the age text picks up the urgency color */}
      <div className='flex items-baseline justify-between gap-2'>
        <span className='text-lg font-semibold'>#{summary.orderNumber}</span>
        <span className={`text-xs ${urgencyTextClass(urgency)}`}>
          {relativeTime(summary.date, nowMs, t, locale)}
        </span>
      </div>
      <div className='text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm'>
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
            <span>{summary.userName}</span>
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
        {localized(summary.roomName) && (
          <span className='flex items-center gap-1'>
            <MapPin className='h-3 w-3' />
            {localized(summary.roomName)}
          </span>
        )}
        {localized(summary.tableName) && (
          <span className='flex items-center gap-1'>
            <Armchair className='h-3 w-3' />
            {localized(summary.tableName)}
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
