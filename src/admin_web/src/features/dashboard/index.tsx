import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { urgencyTextClass } from '@/components/queue-card'
import { Stat, StatStrip } from '@/components/stat-strip'
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
import { LiveFloor } from './components/live-floor'
import { MonthMoney } from './components/month-money'
import { TodaysTill } from './components/todays-till'
import { Trends } from './components/trends'

type AttentionLine = {
  key: string
  to: '/orders' | '/requests' | '/inventory'
  search?: Record<string, unknown>
  dot: string
  text: string
  detail?: string
  detailClass?: string
}

/**
 * The branch right now: what needs someone (unboxed lines), four numbers
 * that each open the page behind them, the live floor beside today's till,
 * and the trends below. One bordered surface on the whole page.
 */
export function Dashboard() {
  const t = useT()
  const auth = useAuth()
  const owner = isOwner(auth.user)
  const features = useFeatures()
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

  const report = reportQuery.data
  const dateTime = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })

  const attention: AttentionLine[] = []
  if (pending.length > 0) {
    attention.push({
      key: 'orders',
      to: '/orders',
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
  if (requestCount > 0) {
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

      <StatStrip>
        <Stat
          label={t('netSales')}
          value={formatEgp(report?.net)}
          hint={t('posTicketsCount', {
            count: Number(report?.ticketsSettled ?? 0),
          })}
          loading={dayWindow === null || reportQuery.isPending}
          to='/till'
        />
        <Stat
          label={t('pendingOrders')}
          value={pending.length}
          tone={pending.length > 0 ? 'warning' : 'default'}
          loading={pendingQuery.isPending}
          to='/orders'
        />
        {features.timeBilling && (
          <Stat
            label={t('placesInUse')}
            value={t('ofTotal', {
              count: running.length,
              total: timedInService,
            })}
            loading={floor.isPending}
            to='/places'
          />
        )}
        <Stat
          label={t('tablesInUse')}
          value={t('ofTotal', { count: busyTables, total: activeTables })}
          loading={floor.isPending}
          to='/places'
        />
      </StatStrip>

      <div className='grid gap-6 lg:grid-cols-2'>
        {(features.timeBilling || features.reservations) && (
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
        )}
        <TodaysTill
          report={report}
          isLoading={dayWindow === null || reportQuery.isPending}
          error={reportQuery.error}
          onRetry={() => reportQuery.refetch()}
        />
      </div>

      {/* The owners' month: the profit feed is theirs alone */}
      {owner && features.finance && <MonthMoney />}

      <Trends />
    </Main>
  )
}
