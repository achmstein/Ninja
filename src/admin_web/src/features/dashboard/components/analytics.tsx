import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getOrderStatsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getSessionStatsOptions } from '@/api/rooms/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEgp } from '@/features/orders/status'

type Range = '7d' | '30d' | '90d'

const ranges: { value: Range; key: TranslationKey; days: number }[] = [
  { value: '7d', key: 'last7Days', days: 7 },
  { value: '30d', key: 'last30Days', days: 30 },
  { value: '90d', key: 'last90Days', days: 90 },
]

type DayRow = {
  date: string
  revenue: number
  orders: number
  hours: number
  sessions: number
}

// Local YYYY-MM-DD, matching the backend's tz-adjusted DateOnly buckets
function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// The backend only returns days that have data; the time axis needs every
// day of the range so quiet days show as gaps, not as a compressed axis
function fillDays(
  from: Date,
  days: number,
  orderDays: Map<string, { revenue: number; orders: number }>,
  sessionDays: Map<string, { hours: number; sessions: number }>
): DayRow[] {
  const rows: DayRow[] = []
  for (let i = 0; i < days; i++) {
    const day = new Date(from)
    day.setDate(from.getDate() + i)
    const key = localDayKey(day)
    rows.push({
      date: key,
      revenue: orderDays.get(key)?.revenue ?? 0,
      orders: orderDays.get(key)?.orders ?? 0,
      hours: sessionDays.get(key)?.hours ?? 0,
      sessions: sessionDays.get(key)?.sessions ?? 0,
    })
  }
  return rows
}

// Minimal typed wrapper around recharts' loosely-typed tooltip props
function ChartTip<T>({
  active,
  payload,
  render,
}: {
  active?: boolean
  payload?: Array<{ payload: T }>
  render: (row: T) => React.ReactNode
}) {
  if (!active || !payload?.length) return null
  return (
    <div className='bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md'>
      {render(payload[0].payload)}
    </div>
  )
}

const axisTick = { fill: 'var(--muted-foreground)', fontSize: 12 }
const barCursor = { fill: 'var(--accent)', opacity: 0.6 }

export function AnalyticsSection() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const [range, setRange] = useState<Range>('30d')

  const { fromDate, toDate, days } = useMemo(() => {
    const count = ranges.find((r) => r.value === range)!.days
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - (count - 1))
    // Next local midnight — stable across renders for the whole day
    const to = new Date()
    to.setHours(24, 0, 0, 0)
    return { fromDate: from, toDate: to, days: count }
  }, [range])

  const tzOffsetMinutes = new Date().getTimezoneOffset()

  const orderStats = useQuery(
    getOrderStatsOptions({
      query: {
        'api-version': API_VERSION,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        tzOffsetMinutes,
      },
    })
  )
  const sessionStats = useQuery(
    getSessionStatsOptions({
      query: {
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString(),
        tzOffsetMinutes,
      },
    })
  )

  const dayRows = useMemo(() => {
    const orderDays = new Map(
      (orderStats.data?.days ?? []).map((d) => [
        d.date ?? '',
        { revenue: Number(d.revenue ?? 0), orders: Number(d.orders ?? 0) },
      ])
    )
    const sessionDays = new Map(
      (sessionStats.data?.days ?? []).map((d) => [
        d.date ?? '',
        { hours: Number(d.hours ?? 0), sessions: Number(d.sessions ?? 0) },
      ])
    )
    return fillDays(fromDate, days, orderDays, sessionDays)
  }, [orderStats.data, sessionStats.data, fromDate, days])

  const topItems = (orderStats.data?.topItems ?? []).map((item) => ({
    name: localized(item.productName) || '—',
    units: Number(item.units ?? 0),
    revenue: Number(item.revenue ?? 0),
  }))

  const roomRows = (sessionStats.data?.rooms ?? []).map((room) => ({
    name: localized(room.roomName) || '—',
    hours: Number(room.hours ?? 0),
    sessions: Number(room.sessions ?? 0),
    revenue: Number(room.revenue ?? 0),
  }))

  const totalRevenue = dayRows.reduce((sum, d) => sum + d.revenue, 0)
  const totalHours = dayRows.reduce((sum, d) => sum + d.hours, 0)

  const shortDay = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)

  const isLoading = orderStats.isLoading || sessionStats.isLoading

  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-lg font-semibold tracking-tight'>
          {t('analyticsTitle')}
        </h2>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger size='sm' className='h-8 w-[140px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ranges.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {t(r.key)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className='grid gap-6 lg:grid-cols-2'>
        <ChartCard
          title={t('revenueByDay')}
          description={
            totalRevenue > 0
              ? `${t('revenueByDayDescription')} · ${formatEgp(totalRevenue)}`
              : t('revenueByDayDescription')
          }
          isLoading={isLoading}
          isEmpty={totalRevenue === 0}
          emptyMessage={t('noAnalyticsData')}
        >
          <ResponsiveContainer width='100%' height={256}>
            <BarChart data={dayRows} margin={{ top: 8, left: -8, right: 8 }}>
              <CartesianGrid vertical={false} stroke='var(--border)' />
              <XAxis
                dataKey='date'
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={shortDay}
                minTickGap={24}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={compact}
                width={44}
              />
              <Tooltip
                cursor={barCursor}
                content={
                  <ChartTip<DayRow>
                    render={(row) => (
                      <div className='flex flex-col gap-0.5'>
                        <span className='font-medium'>{shortDay(row.date)}</span>
                        <span>{formatEgp(row.revenue)}</span>
                        <span className='text-muted-foreground'>
                          {row.orders} {t('ordersLabel')}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey='revenue'
                fill='var(--primary)'
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('roomHoursByDay')}
          description={
            totalHours > 0
              ? `${t('roomHoursByDayDescription')} · ${t('billedHoursFormat', { hours: totalHours })}`
              : t('roomHoursByDayDescription')
          }
          isLoading={isLoading}
          isEmpty={totalHours === 0}
          emptyMessage={t('noAnalyticsData')}
        >
          <ResponsiveContainer width='100%' height={256}>
            <BarChart data={dayRows} margin={{ top: 8, left: -8, right: 8 }}>
              <CartesianGrid vertical={false} stroke='var(--border)' />
              <XAxis
                dataKey='date'
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                tickFormatter={shortDay}
                minTickGap={24}
              />
              <YAxis
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                cursor={barCursor}
                content={
                  <ChartTip<DayRow>
                    render={(row) => (
                      <div className='flex flex-col gap-0.5'>
                        <span className='font-medium'>{shortDay(row.date)}</span>
                        <span>{t('billedHoursFormat', { hours: row.hours })}</span>
                        <span className='text-muted-foreground'>
                          {row.sessions} {t('sessionsLabel')}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey='hours'
                fill='var(--primary)'
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('topItemsTitle')}
          description={t('topItemsDescription')}
          isLoading={isLoading}
          isEmpty={topItems.length === 0}
          emptyMessage={t('noAnalyticsData')}
        >
          <ResponsiveContainer
            width='100%'
            height={Math.max(180, topItems.length * 40)}
          >
            <BarChart
              data={topItems}
              layout='vertical'
              margin={{ top: 4, right: 40, left: 8 }}
            >
              <XAxis type='number' hide />
              <YAxis
                type='category'
                dataKey='name'
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                cursor={barCursor}
                content={
                  <ChartTip<(typeof topItems)[number]>
                    render={(row) => (
                      <div className='flex flex-col gap-0.5'>
                        <span className='font-medium'>{row.name}</span>
                        <span>
                          {row.units} {t('unitsLabel')}
                        </span>
                        <span className='text-muted-foreground'>
                          {formatEgp(row.revenue)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey='units'
                fill='var(--primary)'
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              >
                <LabelList
                  dataKey='units'
                  position='right'
                  fill='var(--foreground)'
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={t('hoursByRoomTitle')}
          description={t('hoursByRoomDescription')}
          isLoading={isLoading}
          isEmpty={roomRows.length === 0}
          emptyMessage={t('noAnalyticsData')}
        >
          <ResponsiveContainer
            width='100%'
            height={Math.max(180, roomRows.length * 40)}
          >
            <BarChart
              data={roomRows}
              layout='vertical'
              margin={{ top: 4, right: 40, left: 8 }}
            >
              <XAxis type='number' hide />
              <YAxis
                type='category'
                dataKey='name'
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                cursor={barCursor}
                content={
                  <ChartTip<(typeof roomRows)[number]>
                    render={(row) => (
                      <div className='flex flex-col gap-0.5'>
                        <span className='font-medium'>{row.name}</span>
                        <span>{t('billedHoursFormat', { hours: row.hours })}</span>
                        <span className='text-muted-foreground'>
                          {row.sessions} {t('sessionsLabel')} ·{' '}
                          {formatEgp(row.revenue)}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Bar
                dataKey='hours'
                fill='var(--primary)'
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              >
                <LabelList
                  dataKey='hours'
                  position='right'
                  fill='var(--foreground)'
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </section>
  )
}

function ChartCard({
  title,
  description,
  isLoading,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string
  description: string
  isLoading: boolean
  isEmpty: boolean
  emptyMessage: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {/* Recharts measures poorly inside RTL containers — keep the plot LTR;
          labels and tooltips still render localized text */}
      <CardContent dir='ltr'>
        {isLoading ? (
          <Skeleton className='h-64 w-full' />
        ) : isEmpty ? (
          <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
