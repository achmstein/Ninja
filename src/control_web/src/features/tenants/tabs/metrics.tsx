import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3 } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { TenantDetail } from '@/api/control'
import { getTenantMetricsOptions } from '@/api/control/@tanstack/react-query.gen'
import { Stat, StatStrip } from '@/components/stat-strip'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useLocale, useT } from '@/lib/i18n'
import { formatMoney } from '@/lib/locale'
import { statusLabelKey, tenantStatus } from '@/lib/tenant'

const RANGES = [7, 30, 90] as const

/**
 * What the café did over the last days, read from its own APIs: the
 * headline numbers, orders and revenue per day, and what sold most.
 */
export function MetricsTab({ tenant }: { tenant: TenantDetail }) {
  const t = useT()
  const locale = useLocale()
  const [days, setDays] = useState<number>(30)
  const status = tenantStatus(tenant.status)
  const running = status === 'Running'
  const currency = tenant.locale.currency

  const metrics = useQuery({
    ...getTenantMetricsOptions({ path: { slug: tenant.slug }, query: { days } }),
    enabled: running,
  })

  if (!running) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <BarChart3 />
          </EmptyMedia>
          <EmptyTitle>{t('noMetrics')}</EmptyTitle>
          <EmptyDescription>{t(statusLabelKey[status])}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const data = metrics.data
  const loading = metrics.isLoading
  const money = (v: number | string | null | undefined) => formatMoney(v, currency, 'en')
  const count = (v: number | string | null | undefined) =>
    new Intl.NumberFormat(locale).format(Number(v ?? 0))
  const series = (data?.series ?? []).map((d) => ({
    date: d.date,
    orders: Number(d.orders),
    revenue: Number(d.revenue),
  }))
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const dayLabel = (value: string) => day.format(new Date(value))

  const config = {
    orders: { label: t('orders'), color: 'var(--chart-1)' },
    revenue: { label: t('revenue'), color: 'var(--chart-2)' },
  } satisfies ChartConfig

  return (
    <div className='flex flex-col gap-6'>
      <ToggleGroup
        type='single'
        variant='outline'
        size='sm'
        value={String(days)}
        onValueChange={(v) => v && setDays(Number(v))}
        aria-label={t('metrics')}
      >
        {RANGES.map((n) => (
          <ToggleGroupItem key={n} value={String(n)} className='px-3'>
            {t('lastDays', { count: n })}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <StatStrip>
        <Stat label={t('orders')} value={count(data?.orders)} loading={loading} />
        <Stat label={t('revenue')} value={money(data?.revenue)} loading={loading} />
        <Stat label={t('tickets')} value={count(data?.ticketsSettled)} loading={loading} />
        <Stat label={t('netSales')} value={money(data?.netSales)} loading={loading} />
        <Stat
          label={t('monthProfit')}
          value={data?.monthProfit == null ? '—' : money(data.monthProfit)}
          loading={loading}
        />
        <Stat label={t('customers')} value={count(data?.loyaltyAccounts)} loading={loading} />
      </StatStrip>

      {loading ? (
        <Skeleton className='h-64 w-full' />
      ) : (
        <div dir='ltr'>
          <ChartContainer config={config} className='h-64 w-full'>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey='date'
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={dayLabel}
              />
              <YAxis yAxisId='orders' tickLine={false} axisLine={false} width={32} allowDecimals={false} />
              <YAxis
                yAxisId='revenue'
                orientation='right'
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => dayLabel(String(value))}
                    formatter={(value, name) => (
                      <div className='flex flex-1 items-center justify-between gap-4'>
                        <span className='text-muted-foreground'>
                          {config[name as keyof typeof config]?.label ?? name}
                        </span>
                        <span className='font-mono font-medium tabular-nums'>
                          {name === 'revenue' ? money(Number(value)) : count(Number(value))}
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <Area
                yAxisId='orders'
                dataKey='orders'
                type='monotone'
                stroke='var(--color-orders)'
                fill='var(--color-orders)'
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                yAxisId='revenue'
                dataKey='revenue'
                type='monotone'
                stroke='var(--color-revenue)'
                fill='var(--color-revenue)'
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}

      {data && data.topItems.length > 0 && (
        <div className='rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('topItems')}</TableHead>
                <TableHead className='text-end'>{t('units')}</TableHead>
                <TableHead className='text-end'>{t('revenue')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topItems.map((item) => (
                <TableRow key={item.name}>
                  <TableCell className='font-medium'>{item.name}</TableCell>
                  <TableCell className='text-end tabular-nums'>{count(item.units)}</TableCell>
                  <TableCell className='text-end tabular-nums'>{money(item.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {data && data.warnings.length > 0 && (
        <ul className='text-muted-foreground flex flex-col gap-1 text-xs'>
          {data.warnings.map((w) => (
            <li key={w} className='flex items-center gap-2'>
              <span className='font-mono'>{w}</span>
              <span>{t('didNotAnswer')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
