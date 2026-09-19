import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { getOrderStatsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getStayStatsOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { RankedList } from '@/components/ranked-list'
import { formatEgp } from '@/features/orders/status'
import { useFeatures } from '@/lib/brand'

const route = getRouteApi('/_authenticated/')

type Range = '7d' | '30d' | '90d'

const ranges: { value: Range; key: TranslationKey; days: number }[] = [
  { value: '7d', key: 'last7Days', days: 7 },
  { value: '30d', key: 'last30Days', days: 30 },
  { value: '90d', key: 'last90Days', days: 90 },
]

type DayRow = { date: string; revenue: number; orders: number }

// Local YYYY-MM-DD, matching the backend's tz-adjusted DateOnly buckets
function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * How the last weeks went: revenue as one area chart, then the top items
 * and the places that sold the most time as ranked lists you can read
 * without hovering.
 * Range lives in the URL.
 */
export function Trends() {
  const t = useT()
  const features = useFeatures()
  const locale = useLocale()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const range: Range = search.range ?? '30d'

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
  const statsQuery = {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    tzOffsetMinutes,
  }

  const orderStats = useQuery({
    ...getOrderStatsOptions({
      query: { 'api-version': API_VERSION, ...statsQuery },
    }),
    refetchInterval: 5 * 60_000,
  })
  const stayStats = useQuery({
    ...getStayStatsOptions({ query: statsQuery }),
    refetchInterval: 5 * 60_000,
  })

  // The backend only returns days that have data; the axis needs every day
  const dayRows = useMemo<DayRow[]>(() => {
    const byDay = new Map(
      (orderStats.data?.days ?? []).map((d) => [
        d.date ?? '',
        { revenue: Number(d.revenue ?? 0), orders: Number(d.orders ?? 0) },
      ])
    )
    const rows: DayRow[] = []
    for (let i = 0; i < days; i++) {
      const day = new Date(fromDate)
      day.setDate(fromDate.getDate() + i)
      const key = localDayKey(day)
      rows.push({
        date: key,
        revenue: byDay.get(key)?.revenue ?? 0,
        orders: byDay.get(key)?.orders ?? 0,
      })
    }
    return rows
  }, [orderStats.data, fromDate, days])

  const totalRevenue = dayRows.reduce((sum, d) => sum + d.revenue, 0)

  const topItems = (orderStats.data?.topItems ?? []).map((item, index) => ({
    key: `${index}`,
    label: localized(item.productName) || '—',
    value: Number(item.units ?? 0),
    display: `${Number(item.units ?? 0)} ${t('unitsLabel')}`,
    hint: formatEgp(item.revenue),
  }))

  const placeRows = [...(stayStats.data?.places ?? [])]
    .map((place, index) => ({
      key: `${index}`,
      label: localized(place.placeName) || '—',
      value: Number(place.hours ?? 0),
      display: t('billedHoursFormat', { hours: Number(place.hours ?? 0) }),
      hint: `${Number(place.stays ?? 0)} ${t('visitsLabel')}`,
    }))
    .sort((a, b) => b.value - a.value)

  const shortDay = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)

  const chartConfig = {
    revenue: { label: t('revenueByDay'), color: 'var(--chart-1)' },
  } satisfies ChartConfig

  return (
    <section className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h2 className='text-sm font-semibold'>{t('trends')}</h2>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={range}
          onValueChange={(value) => {
            if (!value) return
            navigate({
              search: (prev) => ({
                ...prev,
                range: value === '30d' ? undefined : (value as Range),
              }),
            })
          }}
        >
          {ranges.map((r) => (
            <ToggleGroupItem key={r.value} value={r.value} className='px-3'>
              {t(r.key)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {orderStats.isError ? (
        <ErrorState
          error={orderStats.error}
          onRetry={() => orderStats.refetch()}
        />
      ) : (
        <div>
          <div className='mb-2 flex items-baseline justify-between'>
            <h3 className='text-sm font-medium'>{t('revenueByDay')}</h3>
            {totalRevenue > 0 && (
              <span className='text-muted-foreground text-sm tabular-nums'>
                {formatEgp(totalRevenue)}
              </span>
            )}
          </div>
          {orderStats.isLoading ? (
            <Skeleton className='h-64 w-full' />
          ) : totalRevenue === 0 ? (
            <EmptyState compact title={t('noAnalyticsData')} />
          ) : (
            <ChartContainer
              config={chartConfig}
              className='aspect-auto h-64 w-full'
            >
              <AreaChart
                data={dayRows}
                margin={{ top: 8, left: 0, right: 8, bottom: 0 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey='date'
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={28}
                  tickFormatter={shortDay}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={compact}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(label) => shortDay(String(label))}
                      formatter={(value, _name, item) => (
                        <div className='flex w-full items-center justify-between gap-4'>
                          <span className='font-medium tabular-nums'>
                            {formatEgp(Number(value))}
                          </span>
                          <span className='text-muted-foreground'>
                            {Number(item.payload?.orders ?? 0)}{' '}
                            {t('ordersLabel')}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey='revenue'
                  type='monotone'
                  fill='var(--color-revenue)'
                  fillOpacity={0.15}
                  stroke='var(--color-revenue)'
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-2'>
        <div>
          <h3 className='mb-1 text-sm font-medium'>{t('topItemsTitle')}</h3>
          {orderStats.isLoading ? (
            <Skeleton className='h-40 w-full' />
          ) : topItems.length === 0 ? (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('noAnalyticsData')}
            </p>
          ) : (
            <RankedList items={topItems} />
          )}
        </div>
        {features.rooms && (
        <div>
          <h3 className='mb-1 text-sm font-medium'>{t('timeByPlace')}</h3>
          {stayStats.isError ? (
            <ErrorState
              error={stayStats.error}
              onRetry={() => stayStats.refetch()}
            />
          ) : stayStats.isLoading ? (
            <Skeleton className='h-40 w-full' />
          ) : placeRows.length === 0 ? (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('noAnalyticsData')}
            </p>
          ) : (
            <RankedList items={placeRows} />
          )}
        </div>
        )}
      </div>
    </section>
  )
}
