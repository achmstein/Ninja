import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import {
  getBreakdownReportOptions,
  getDailyReportOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { getStayStatsOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useNow } from '@/lib/business-clock'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { localDateOf, parsePlainDate } from '@/lib/zoned-time'
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
import { useTillWindow } from '@/features/till/use-till-window'
import { dayStartParam, trendRows, trendWindows } from '../trend-rows'
import { changeOf, formatChange } from './kpi-card'

const route = getRouteApi('/_authenticated/')

type Range = '7d' | '30d' | '90d'

const ranges: { value: Range; key: TranslationKey; days: number }[] = [
  { value: '7d', key: 'last7Days', days: 7 },
  { value: '30d', key: 'last30Days', days: 30 },
  { value: '90d', key: 'last90Days', days: 90 },
]

/**
 * The range in the URL and its business-day windows: the last N business
 * days of the active branch (from its day start, in the business's zone)
 * and the N before them, cut to the same time into today's twin. Recomputed
 * every minute; the bounds only move when a business day rolls over (and
 * the comparison's end every five minutes).
 */
function useRange() {
  const search = route.useSearch()
  const range: Range = search.range ?? '30d'
  const days = ranges.find((r) => r.value === range)!.days
  const { branch, hours, timeZone } = useTillWindow({})
  const now = useNow()
  const windows = hours ? trendWindows(now, hours, days) : null
  return {
    range,
    days,
    windows,
    timeZone,
    dayStart: dayStartParam(branch?.dayStartTime),
  }
}

/**
 * Net sales per business day (Sales' daily report: what customers paid less
 * the refunds given that day) as shadcn's interactive area chart: this
 * period as a soft filled area, the same number of business days before it
 * as a faint dashed line underneath, and in the header the total and how it
 * moved against the same stretch before (today only as far as it has gone).
 * The range is a select on a phone and a toggle where there is room; it
 * lives in the URL.
 */
export function SalesChart() {
  const t = useT()
  const locale = useLocale()
  const navigate = route.useNavigate()
  const { range, days, windows, timeZone, dayStart } = useRange()

  const current = useQuery({
    ...getDailyReportOptions({
      query: {
        'api-version': API_VERSION,
        from: windows?.current.from.toISOString() ?? '',
        to: windows?.current.to.toISOString() ?? '',
        tz: timeZone,
        dayStart,
      },
    }),
    enabled: windows !== null,
    refetchInterval: 5 * 60_000,
  })
  const previous = useQuery({
    ...getDailyReportOptions({
      query: {
        'api-version': API_VERSION,
        from: windows?.previous.from.toISOString() ?? '',
        to: windows?.previous.to.toISOString() ?? '',
        tz: timeZone,
        dayStart,
      },
    }),
    enabled: windows !== null,
  })

  // Every business day on the axis, each with its twin before
  const rows = windows
    ? trendRows(windows, days, current.data?.days, previous.data?.days)
    : []

  const total = rows.reduce((sum, d) => sum + d.revenue, 0)
  const totalBefore = rows.reduce((sum, d) => sum + d.previous, 0)
  const change = previous.isSuccess ? changeOf(total, totalBefore) : undefined

  // A business day by its date, whatever zone the browser is in
  const shortDay = (key: string) => {
    const date = parsePlainDate(key)
    return date
      ? localDateOf(date).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'short',
        })
      : key
  }
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
        <CardTitle>{t('netSalesByDay')}</CardTitle>
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
        ) : current.isLoading || windows === null ? (
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
                              ·{' '}
                              {t('posTicketsCount', {
                                count: Number(item.payload?.tickets ?? 0),
                              })}
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
 * What sold over the same days: the top items by what customers paid for
 * them less what was refunded (Sales' breakdown, the same money as net
 * sales, grouped by catalog item), and the places that sold the most time,
 * as ranked bars that read without hovering, each in a card.
 */
export function TopLists() {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const { windows, timeZone } = useRange()
  const from = windows?.current.from
  const to = windows?.current.to

  const breakdown = useQuery({
    ...getBreakdownReportOptions({
      query: {
        'api-version': API_VERSION,
        from: from?.toISOString() ?? '',
        to: to?.toISOString() ?? '',
        tz: timeZone,
      },
    }),
    enabled: windows !== null,
    refetchInterval: 5 * 60_000,
  })
  const stayStats = useQuery({
    ...getStayStatsOptions({
      query: {
        fromDate: from?.toISOString() ?? '',
        toDate: to?.toISOString() ?? '',
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      },
    }),
    refetchInterval: 5 * 60_000,
    enabled: features.timeBilling && windows !== null,
  })

  // Ranked by net paid; the delivery fee is not an item and is not listed
  const topItems = [...(breakdown.data?.byItem ?? [])]
    .map((item) => ({
      item,
      amount: Number(item.netAmount ?? item.amount ?? 0),
      qty: Number(item.netQty ?? item.qty ?? 0),
    }))
    .filter((row) => row.amount > 0 || row.qty > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(({ item, amount, qty }, index) => ({
      key: `${item.catalogItemId ?? index}`,
      label: localized(item.description) || '—',
      value: amount,
      display: formatEgp(amount),
      hint: `${qty} ${t('unitsLabel')}`,
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
          {breakdown.isError ? (
            <ErrorState
              error={breakdown.error}
              onRetry={() => breakdown.refetch()}
            />
          ) : breakdown.isLoading || windows === null ? (
            <Skeleton className='h-40 w-full' />
          ) : topItems.length === 0 ? (
            <p className='text-muted-foreground py-3 text-sm'>
              {t('noAnalyticsData')}
            </p>
          ) : (
            <RankedList items={topItems} className='divide-y-0' />
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
              <RankedList items={placeRows} className='divide-y-0' />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
