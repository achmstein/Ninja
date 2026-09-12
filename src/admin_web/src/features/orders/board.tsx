import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Clock } from 'lucide-react'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { OrdersTabs } from './components/orders-tabs'
import { PendingOrderCard } from './components/pending-order-card'
import { orderPlace, orderUrgency, type OrderPlace } from './status'
import { useOrderActions } from './use-order-actions'

const route = getRouteApi('/_authenticated/orders/')

// Past this many tickets the wall needs grouping to stay scannable
const FILTER_THRESHOLD = 12

/**
 * The live queue: every submitted order with its full contents, oldest
 * first. Confirming or cancelling removes the card — an empty queue means
 * all caught up.
 */
export function OrdersBoard() {
  const t = useT()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { confirm, cancel, actingOrderNumber } = useOrderActions()

  // Tapping a card's customer name opens their hub on the Customers page
  const globalNavigate = useNavigate()
  const openCustomer = (customerId: string) =>
    globalNavigate({ to: '/customers', search: { customer: customerId } })

  // Cancelling is irreversible for the customer: always a confirm step
  const [cancelTarget, setCancelTarget] = useState<number | null>(null)

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

  const place = search.place
  const counts: Record<OrderPlace, number> = { rooms: 0, tables: 0, counter: 0 }
  for (const order of pending) counts[orderPlace(order)] += 1
  const visible = place
    ? pending.filter((order) => orderPlace(order) === place)
    : pending
  const showFilter = pending.length > FILTER_THRESHOLD || place != null

  const setPlace = (value: string) =>
    navigate({
      search: (prev) => ({
        ...prev,
        place: value && value !== 'all' ? (value as OrderPlace) : undefined,
      }),
    })

  return (
    <>
      <Main className='flex flex-col gap-4'>
        <PageHeader
          title={t('orders')}
          description={t('liveOrdersSubtitle')}
          badge={
            <>
              {pending.length > 0 && (
                <Badge className='h-6 tabular-nums'>{pending.length}</Badge>
              )}
              {delayedCount > 0 && (
                <Badge variant='destructive' className='h-6 gap-1 tabular-nums'>
                  <Clock className='h-3 w-3' />
                  {delayedCount} {t('delayed')}
                </Badge>
              )}
            </>
          }
        >
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <OrdersTabs value='live' pendingCount={pending.length} />
            {showFilter && (
              <ToggleGroup
                type='single'
                variant='outline'
                size='sm'
                value={place ?? 'all'}
                onValueChange={setPlace}
                aria-label={t('filterByPlace')}
              >
                <ToggleGroupItem value='all' className='px-3'>
                  {t('all')}
                </ToggleGroupItem>
                <ToggleGroupItem value='rooms' className='gap-1.5 px-3'>
                  {t('rooms')}
                  <span className='text-muted-foreground tabular-nums'>
                    {counts.rooms}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem value='tables' className='gap-1.5 px-3'>
                  {t('tables')}
                  <span className='text-muted-foreground tabular-nums'>
                    {counts.tables}
                  </span>
                </ToggleGroupItem>
                <ToggleGroupItem value='counter' className='gap-1.5 px-3'>
                  {t('counter')}
                  <span className='text-muted-foreground tabular-nums'>
                    {counts.counter}
                  </span>
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </div>
        </PageHeader>

        {pendingQuery.isError ? (
          <ErrorState
            error={pendingQuery.error}
            onRetry={() => pendingQuery.refetch()}
          />
        ) : pendingQuery.isLoading ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='h-56' />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title={t('allClear')}
            description={t('newOrdersAppearInstantly')}
          />
        ) : (
          // A grid, not CSS columns: reading order is the queue order
          <div className='grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {visible.map((order) => (
              <PendingOrderCard
                key={String(order.orderNumber)}
                summary={order}
                nowMs={nowMs}
                onConfirm={() => confirm(Number(order.orderNumber))}
                onCancel={() => setCancelTarget(Number(order.orderNumber))}
                onViewCustomer={
                  order.userId ? () => openCustomer(order.userId!) : undefined
                }
                // Only the card being acted on shows busy
                isActing={
                  Number(actingOrderNumber) === Number(order.orderNumber)
                }
              />
            ))}
          </div>
        )}
      </Main>

      <ConfirmDialog
        open={cancelTarget != null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        title={t('cancelOrderQuestion')}
        desc={t('cancelOrderConfirmation')}
        cancelBtnText={t('keepOrder')}
        confirmText={t('cancelOrderButton')}
        destructive
        handleConfirm={() => {
          if (cancelTarget != null) cancel(cancelTarget)
          setCancelTarget(null)
        }}
      />
    </>
  )
}
