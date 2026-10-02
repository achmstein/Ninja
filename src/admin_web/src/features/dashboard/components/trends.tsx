import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import { getOrderStatsOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { getStayStatsOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { RankedList } from '@/components/ranked-list'
import { formatEgp } from '@/features/orders/status'
import { changeOf, formatChange } from './kpi-card'

const route = getRouteApi('/_authenticated/')

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
  previous: number
}

// Local YYYY-MM-DD, matching the backend's tz-adjusted DateOnly buckets
function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** The range in the URL, and the days it covers with the same span before it */
function useRange() {
  const search = route.useSearch()
  const range: Range = search.range ?? '30d'
  const window = useMemo(() => {
    const days = ranges.find((r) => r.value === range)!.days
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    from.setDate(from.getDate() - (days - 1))
    // Next local midnight: stable across renders for the whole day
    const to = new Date()
    to.setHours(24, 0, 0, 0)
    const previousFrom = new Date(from)
    previousFrom.setDate(from.getDate() - days)
    return { days, from, to, previousFrom }
  }, [range])
  return { range, ...window }
}

function statsQuery(from: Date, to: Date) {
  return {
    fromDate: from.toISOString(),
    toDate: to.toISOString(),
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  }
}

/**
 * Sales over the chosen days as shadcn's interactive area chart: this period
 * as a soft filled area, the same number of days before it as a faint dashed
 * line underneath, and in the header the total and how it moved against the
 * days before. The range is a select on a phone and a toggle where there is
 * room; it lives in the URL.
 */
export function SalesChart() {
  const t = useT()
  const locale = useLocale()
  const navigate = route.useNavigate()
  const { range, days, from, to, previousFrom } = useRange()

  const current = useQuery({
    ...getOrderStatsOptions({
      query: { 'api-version': API_VERSION, ...statsQuery(from, to) },
    }),
    refetchInterval: 5 * 60_000,
  })
  const previous = useQuery({
    ...getOrderStatsOptions({
      query: { 'api-version': API_VERSION, ...statsQuery(previousFrom, from) },
    }),
  })

  // The backend only returns days that have data; the axis needs every day, and each day its twin before
  const rows = useMemo<DayRow[]>(() => {
    const byDay = (list: typeof current.data) =>
      new Map((list?.days ?? []).map((d) => [d.date ?? '', d]))
    const now = byDay(current.data)
    const before = byDay(previous.data)
    return Array.from({ length: days }, (_, i) => {
      const day = new Date(from)
      day.setDate(from.getDate() + i)
      const twin = new Date(previousFrom)
      twin.setDate(previousFrom.getDate() + i)
      const row = now.get(localDayKey(day))
      return {
        date: localDayKey(day),
        revenue: Number(row?.revenue ?? 0),
        orders: Number(row?.orders ?? 0),
        previous: Number(before.get(localDayKey(twin))?.revenue ?? 0),
      }
    })
  }, [current.data, previous.data, days, from, previousFrom])

  const total = rows.reduce((sum, d) => sum + d.revenue, 0)
  const totalBefore = rows.reduce((sum, d) => sum + d.previous, 0)
  const change = previous.isSuccess ? changeOf(total, totalBefore) : undefined

  const shortDay = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
    })
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)

  const config = {
    revenue: { label: t('salesThisPeriod'), color: 'var(--chart-1)' },
    previous: {
      label: t('salesPreviousPeriod'),
      color: 'var(--muted-foreground)',
    },
  } satisfies ChartConfig

  const setRange = (value: string) => {
    if (!value) return
    navigate({
      search: (prev) => ({
        ...prev,
        range: value === '30d' ? undefined : (value as Range),
      }),
    })
  }

  return (
    <Card className='@container/card gap-4'>
      <CardHeader>
        <CardTitle>{t('salesTitle')}</CardTitle>
        <CardDescription className='flex flex-wrap items-center gap-2'>
          {current.isLoading ? (
            <Skeleton className='h-5 w-32' />
          ) : (
            <>
              <span className='text-foreground text-lg font-semibold tabular-nums'>
                {formatEgp(total)}
              </span>
              {change !== undefined && (
                <Badge
                  variant={
                    change == null
                      ? 'muted'
                      : change > 0.005
                        ? 'success'
                        : change < -0.005
                          ? 'danger'
                          : 'muted'
                  }
                  className='rounded-full'
                >
                  {change == null
                    ? t('trendNew')
                    : t('vsPeriodBefore', {
                        change: formatChange(change, locale),
                      })}
                </Badge>
              )}
            </>
          )}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            value={range}
            onValueChange={setRange}
            className='hidden @[560px]/card:flex'
          >
            {ranges.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value} className='px-3'>
                {t(r.key)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger
              size='sm'
              className='w-36 @[560px]/card:hidden'
              aria-label={t('salesTitle')}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align='end'>
              {ranges.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className='px-2 sm:px-6'>
        {current.isError ? (
          <ErrorState error={current.error} onRetry={() => current.refetch()} />
        ) : current.isLoading ? (
          <Skeleton className='h-64 w-full' />
        ) : total === 0 && totalBefore === 0 ? (
          <EmptyState compact title={t('noAnalyticsData')} />
        ) : (
          <ChartContainer config={config} className='aspect-auto h-64 w-full'>
            <AreaChart
              data={rows}
              margin={{ top: 8, left: 0, right: 8, bottom: 0 }}
            >
              <defs>
                <linearGradient id='fillRevenue' x1='0' y1='0' x2='0' y2='1'>
                  <stop
                    offset='5%'
                    stopColor='var(--color-revenue)'
                    stopOpacity={0.45}
                  />
                  <stop
                    offset='95%'
                    stopColor='var(--color-revenue)'
                    stopOpacity={0.02}
                  />
                </linearGradient>
              </defs>
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
                    indicator='dot'
                    labelFormatter={(label) => shortDay(String(label))}
                    formatter={(value, name, item) => (
                      <div className='flex w-full items-center justify-between gap-4'>
                        <span className='text-muted-foreground'>
                          {name === 'previous'
                            ? t('salesPreviousPeriod')
                            : t('salesThisPeriod')}
                        </span>
                        <span className='font-medium tabular-nums'>
                          {formatEgp(Number(value))}
                          {name === 'revenue' && (
                            <span className='text-muted-foreground ms-1 font-normal'>
                              · {Number(item.payload?.orders ?? 0)}{' '}
                              {t('ordersLabel')}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Line
                dataKey='previous'
                type='monotone'
                stroke='var(--color-previous)'
                strokeOpacity={0.5}
                strokeWidth={1.5}
                strokeDasharray='4 4'
                dot={false}
                activeDot={false}
              />
              <Area
                dataKey='revenue'
                type='monotone'
                fill='url(#fillRevenue)'
                stroke='var(--color-revenue)'
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * What sold over the same days: the top dishes, and the places that sold the
 * most time, as ranked bars that read without hovering, each in a card.
 */
export function TopLists() {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const { from, to } = useRange()

  const orderStats = useQuery({
    ...getOrderStatsOptions({
      query: { 'api-version': API_VERSION, ...statsQuery(from, to) },
    }),
    refetchInterval: 5 * 60_000,
  })
  const stayStats = useQuery({
    ...getStayStatsOptions({ query: statsQuery(from, to) }),
    refetchInterval: 5 * 60_000,
    enabled: features.timeBilling,
  })

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

  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <Card className='gap-3'>
        <CardHeader>
          <CardTitle>{t('topItemsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {orderStats.isError ? (
            <ErrorState
              error={orderStats.error}
              onRetry={() => orderStats.refetch()}
            />
          ) : orderStats.isLoading ? (
            <Skeleton className='h-40 w-full' />
          ) : topItems.length === 0 ? (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('noAnalyticsData')}
            </p>
          ) : (
            <RankedList items={topItems} />
          )}
        </CardContent>
      </Card>
      {features.timeBilling && (
        <Card className='gap-3'>
          <CardHeader>
            <CardTitle>{t('timeByPlace')}</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
