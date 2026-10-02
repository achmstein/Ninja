import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { urgencyTextClass } from '@/components/queue-card'
import { stockLevelsQueryOptions } from '@/features/inventory/queries'
import { formatEgp, orderUrgency, relativeTime } from '@/features/orders/status'
import {
  isRunning,
  PLACE_OUT_OF_SERVICE,
  PLACE_TABLE,
} from '@/features/places/status'
import { orderIsAt, usePlaces } from '@/features/places/use-places'
import { serviceRequestsService } from '@/features/requests/service'
import { useTillWindow } from '@/features/till/use-till-window'
import { changeOf, KpiCard } from './components/kpi-card'
import { LiveFloor } from './components/live-floor'
import { MonthMoney } from './components/month-money'
import { TodaysTill } from './components/todays-till'
import { SalesChart, TopLists } from './components/trends'

const WEEK_MS = 7 * 24 * 60 * 60_000

type AttentionLine = {
  key: string
  to: '/orders/live' | '/requests' | '/inventory'
  search?: Record<string, unknown>
  dot: string
  text: string
  detail?: string
  detailClass?: string
}

/**
 * The branch right now, phone first: what needs someone (lines under the
 * title), four cards with the numbers an owner looks at first, each against
 * the same time last week and opening the page behind it; sales over the
 * last weeks as one chart against the weeks before; the live floor beside
 * today's till; the owner's month; what sold. One column on a phone, a grid
 * where there is room.
 */
export function Dashboard() {
  const t = useT()
  const auth = useAuth()
  const owner = isOwner(auth.user)
  const features = useFeatures()
  // A cloud kitchen has no tables: no floor, no table counts, no waiter calls
  const cloudKitchen = useIsCloudKitchen()
  const locale = useLocale()
  const localized = useLocalized()

  // Tick every 30s so order ages and urgency colors advance between polls
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // The branch's business day (17:00 → 05:00), re-evaluated every minute
  const { branch, dayWindow, fromIso, toIso } = useTillWindow({})

  const pendingQuery = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR is the primary update path; polls are only a fallback
    refetchInterval: 60_000,
  })
  const requestsQuery = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => serviceRequestsService.pending(),
    refetchInterval: 60_000,
    enabled: !cloudKitchen,
  })
  const lowStockQuery = useQuery({
    ...stockLevelsQueryOptions({ low: true }),
    refetchInterval: 60_000,
    enabled: features.inventory,
  })
  const floor = usePlaces()
  const reportQuery = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
    refetchInterval: 60_000,
  })

  const pending = useMemo(
    () =>
      [...(pendingQuery.data ?? [])].sort(
        (a, b) =>
          new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
      ),
    [pendingQuery.data]
  )
  const oldest = pending[0]
  const oldestUrgency = orderUrgency(oldest?.date, nowMs)
  const requestCount = requestsQuery.data?.length ?? 0
  const lowCount = lowStockQuery.data?.length ?? 0

  const { places } = floor
  const running = floor.stays.filter(isRunning)
  // Timed places run a clock; an untimed table only takes orders
  const timedInService = places.filter(
    (p) => p.isTimed && Number(p.status) !== PLACE_OUT_OF_SERVICE
  ).length
  const tables = places.filter(
    (p) => Number(p.kind) === PLACE_TABLE && !p.isTimed
  )
  const activeTables = tables.filter((table) => table.isActive).length
  const busyTables = tables.filter((table) =>
    pending.some((order) => orderIsAt(order, table))
  ).length

  // The same stretch of the day a week ago, up to the same time: a fair
  // comparison while today is still going (to the 5 minutes, so it is not
  // asked for again every tick)
  const lastWeekTo = dayWindow
    ? new Date(
        Math.floor(Math.min(nowMs, dayWindow.to.getTime()) / 300_000) *
          300_000 -
          WEEK_MS
      ).toISOString()
    : ''
  const lastWeekQuery = useQuery({
    ...getRangeReportOptions({
      query: {
        'api-version': API_VERSION,
        from: dayWindow
          ? new Date(dayWindow.from.getTime() - WEEK_MS).toISOString()
          : '',
        to: lastWeekTo,
      },
    }),
    enabled: dayWindow !== null,
  })

  const report = reportQuery.data
  const net = Number(report?.net ?? 0)
  const bills = Number(report?.ticketsSettled ?? 0)
  const lastWeek = lastWeekQuery.data
  const lastNet = Number(lastWeek?.net ?? 0)
  const lastBills = Number(lastWeek?.ticketsSettled ?? 0)
  const averageBill = bills > 0 ? net / bills : 0
  const lastAverage = lastBills > 0 ? lastNet / lastBills : 0
  const compared = lastWeekQuery.isSuccess
  const reportLoading = dayWindow === null || reportQuery.isPending
  const dateTime = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  const attention: AttentionLine[] = []
  if (pending.length > 0) {
    attention.push({
      key: 'orders',
      to: '/orders/live',
      dot:
        oldestUrgency === 'delayed'
          ? 'bg-destructive'
          : oldestUrgency === 'warning'
            ? 'bg-warning'
            : 'bg-primary',
      text: t('ordersWaitingLine', { count: pending.length }),
      detail: oldest
        ? t('oldestAge', { age: relativeTime(oldest.date, nowMs, t, locale) })
        : undefined,
      detailClass: urgencyTextClass(oldestUrgency),
    })
  }
  if (!cloudKitchen && requestCount > 0) {
    attention.push({
      key: 'requests',
      to: '/requests',
      dot: 'bg-destructive',
      text: t('requestsWaitingLine', { count: requestCount }),
    })
  }
  if (features.inventory && lowCount > 0) {
    attention.push({
      key: 'stock',
      to: '/inventory',
      search: { low: true },
      dot: 'bg-warning',
      text: t('lowStockLine', { count: lowCount }),
    })
  }

  return (
    <Main>
      <PageHeader
        title={localized(branch?.name) || t('dashboard')}
        description={
          dayWindow
            ? `${dateTime.format(dayWindow.from)} – ${dateTime.format(dayWindow.to)}`
            : undefined
        }
      >
        {attention.length > 0 && (
          <ul className='flex flex-col gap-1.5'>
            {attention.map((line) => (
              <li key={line.key}>
                <Link
                  to={line.to}
                  search={line.search}
                  className='hover:text-foreground inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline'
                >
                  <span className={cn('size-2 rounded-full', line.dot)} />
                  <span className='font-medium'>{line.text}</span>
                  {line.detail && (
                    <span className={cn('text-xs', line.detailClass)}>
                      · {line.detail}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PageHeader>

      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        <KpiCard
          label={t('netSales')}
          value={formatEgp(net)}
          change={compared ? changeOf(net, lastNet) : undefined}
          footer={t('vsSameTimeLastWeek')}
          loading={reportLoading}
          to='/till'
        />
        <KpiCard
          label={t('averageBill')}
          value={bills > 0 ? formatEgp(averageBill) : '—'}
          change={
            compared && bills > 0
              ? changeOf(averageBill, lastAverage)
              : undefined
          }
          footer={t('posTicketsCount', { count: bills })}
          loading={reportLoading}
          to='/till/tickets'
        />
        <KpiCard
          label={t('pendingOrders')}
          value={pending.length}
          tone={pending.length > 0 ? 'warning' : 'default'}
          footer={
            oldest
              ? t('oldestAge', {
                  age: relativeTime(oldest.date, nowMs, t, locale),
                })
              : t('ordersWaitingNone')
          }
          loading={pendingQuery.isPending}
          to='/orders/live'
        />
        {cloudKitchen ? (
          features.inventory && (
            <KpiCard
              label={t('lowStockTitle')}
              value={lowCount}
              tone={lowCount > 0 ? 'warning' : 'default'}
              loading={lowStockQuery.isPending}
              to='/inventory'
              search={{ low: true }}
            />
          )
        ) : features.timeBilling ? (
          <KpiCard
            label={t('placesInUse')}
            value={t('ofTotal', {
              count: running.length,
              total: timedInService,
            })}
            footer={
              t('tablesInUse') +
              ': ' +
              t('ofTotal', { count: busyTables, total: activeTables })
            }
            loading={floor.isPending}
            to='/places'
          />
        ) : (
          <KpiCard
            label={t('tablesInUse')}
            value={t('ofTotal', { count: busyTables, total: activeTables })}
            loading={floor.isPending}
            to='/places'
          />
        )}
      </div>

      <SalesChart />

      <div className='grid gap-4 lg:grid-cols-2'>
        {!cloudKitchen && (features.timeBilling || features.reservations) && (
          <Card>
            <CardContent>
              <LiveFloor
                stays={running}
                places={places}
                pending={pending}
                nowMs={nowMs}
                isLoading={pendingQuery.isLoading || floor.isLoading}
                error={pendingQuery.error ?? floor.error}
                onRetry={() => {
                  pendingQuery.refetch()
                  floor.refetch()
                }}
              />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent>
            <TodaysTill
              report={report}
              isLoading={reportLoading}
              error={reportQuery.error}
              onRetry={() => reportQuery.refetch()}
            />
          </CardContent>
        </Card>
      </div>

      {/* The owners' month: the profit feed is theirs alone */}
      {owner && features.finance && (
        <Card>
          <CardContent>
            <MonthMoney />
          </CardContent>
        </Card>
      )}

      <TopLists />
    </Main>
  )
}
