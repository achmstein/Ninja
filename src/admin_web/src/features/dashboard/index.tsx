import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { isOwner } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getRangeReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import {
  getActiveSessionsOptions,
  listRoomsOptions,
  listTablesOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { urgencyTextClass } from '@/components/queue-card'
import { Stat, StatStrip } from '@/components/stat-strip'
import { stockLevelsQueryOptions } from '@/features/inventory/queries'
import { formatEgp, orderUrgency, relativeTime } from '@/features/orders/status'
import { serviceRequestsService } from '@/features/requests/service'
import { ROOM_MAINTENANCE, SESSION_ACTIVE } from '@/features/rooms/status'
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
  })
  const roomsQuery = useQuery({
    ...listRoomsOptions(),
    refetchInterval: 60_000,
  })
  const sessionsQuery = useQuery({
    ...getActiveSessionsOptions(),
    refetchInterval: 60_000,
  })
  const tablesQuery = useQuery(listTablesOptions())
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

  const rooms = roomsQuery.data ?? []
  const sessions = (sessionsQuery.data ?? []).filter(
    (s) => Number(s.status) === SESSION_ACTIVE
  )
  const roomsInService = rooms.filter(
    (r) => Number(r.displayStatus) !== ROOM_MAINTENANCE
  ).length
  const tables = tablesQuery.data ?? []
  const activeTables = tables.filter((table) => table.isActive).length
  const busyTables = new Set(
    pending
      .map((o) => o.tableId)
      .filter((id): id is number | string => id != null)
      .map(Number)
      .filter((id) => tables.some((table) => Number(table.id) === id))
  ).size

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
  if (lowCount > 0) {
    attention.push({
      key: 'stock',
      to: '/inventory',
      search: { low: true },
      dot: 'bg-warning',
      text: t('lowStockLine', { count: lowCount }),
    })
  }

  return (
    <Main className='flex flex-col gap-8'>
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
        <Stat
          label={t('roomsInUse')}
          value={t('ofTotal', {
            count: sessions.length,
            total: roomsInService,
          })}
          loading={roomsQuery.isPending || sessionsQuery.isPending}
          to='/rooms'
        />
        <Stat
          label={t('tablesInUse')}
          value={t('ofTotal', { count: busyTables, total: activeTables })}
          loading={tablesQuery.isPending}
          to='/tables'
        />
      </StatStrip>

      <div className='grid gap-10 lg:grid-cols-2'>
        <LiveFloor
          sessions={sessions}
          rooms={rooms}
          pending={pending}
          nowMs={nowMs}
          isLoading={pendingQuery.isLoading || sessionsQuery.isLoading}
          error={pendingQuery.error ?? sessionsQuery.error}
          onRetry={() => {
            pendingQuery.refetch()
            sessionsQuery.refetch()
          }}
        />
        <TodaysTill
          report={report}
          isLoading={dayWindow === null || reportQuery.isPending}
          error={reportQuery.error}
          onRetry={() => reportQuery.refetch()}
        />
      </div>

      {/* The owners' month: the profit feed is theirs alone */}
      {owner && <MonthMoney />}

      <Trends />
    </Main>
  )
}
