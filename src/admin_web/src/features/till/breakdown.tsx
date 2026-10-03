import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { LocalizedText } from '@/api/catalog'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { getBreakdownReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { Bar, BarChart, Cell, XAxis } from 'recharts'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import {
  Card,
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
import { EntityAvatar } from '@/components/entity-avatar'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { RankedList } from '@/components/ranked-list'
import { formatEgp, toNumber } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/breakdown')

// A Sunday, so weekday n is this plus n days
const SUNDAY = Date.UTC(2023, 0, 1)

/**
 * The window cut four ways: when the money came in (hour, weekday), who
 * took it, and what sold. Hours and weekdays are in this browser's clock,
 * which is the business's. Charts where a shape says it (when), lists
 * where names do (who, what).
 */
export function TillBreakdown() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  const report = useQuery({
    ...getBreakdownReportOptions({
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        offsetMinutes: -new Date().getTimezoneOffset(),
      },
    }),
    enabled: dayWindow !== null,
  })

  // The category is Catalog's, joined here: Sales names the item on each
  // line, the menu says which category it is in. A line from before the
  // stamp, or an item no longer on the menu, counts as uncategorised.
  const items = useQuery(listItemsOptions({ query: { 'api-version': API_VERSION } }))
  const byCategory = useMemo(() => {
    const category = new Map<number, LocalizedText | undefined>()
    for (const item of items.data ?? []) {
      category.set(toNumber(item.id), item.catalogTypeName ?? undefined)
    }
    const groups = new Map<string, { name: LocalizedText | undefined; qty: number; amount: number }>()
    for (const row of report.data?.byItem ?? []) {
      const name = row.catalogItemId != null ? category.get(toNumber(row.catalogItemId)) : undefined
      const key = name ? localized(name) : ''
      const group = groups.get(key) ?? { name, qty: 0, amount: 0 }
      group.qty += toNumber(row.qty)
      group.amount += toNumber(row.amount)
      groups.set(key, group)
    }
    return [...groups.values()].sort((a, b) => b.amount - a.amount)
  }, [items.data, report.data, localized])

  const data = report.data
  const loading = !dayWindow || report.isPending
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // "8 PM" / "٨ م": the hour as the business says it, not a bare number
  const hour = new Intl.DateTimeFormat(locale, { hour: 'numeric' })
  const hourLabel = (h: number) => hour.format(new Date(2000, 0, 1, h))

  return (
    <TillPage
      tab='breakdown'
      search={search}
      dayWindow={dayWindow}
      onRangeChange={(next) =>
        navigate({ search: (prev) => ({ ...prev, ...next }) })
      }
    >
      {report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : loading || !data ? (
        <div className='grid gap-6'>
          <Skeleton className='h-32' />
          <Skeleton className='h-32' />
          <Skeleton className='h-64' />
        </div>
      ) : (
        <div className='grid gap-4'>
          <div className='grid gap-4 lg:grid-cols-2'>
            <Bars
              title={t('byHour')}
              rows={(data.byHour ?? []).map((h) => ({
                label: hourLabel(toNumber(h.hour)),
                count: toNumber(h.count),
                net: toNumber(h.net),
              }))}
            />
            <Bars
              title={t('byWeekday')}
              rows={(data.byWeekday ?? []).map((d) => ({
                label: weekday.format(
                  new Date(SUNDAY + toNumber(d.weekday) * 86_400_000)
                ),
                count: toNumber(d.count),
                net: toNumber(d.net),
              }))}
            />
          </div>

          <Card className='gap-3'>
            <CardHeader>
              <CardTitle>{t('byCashier')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className='divide-y'>
                {(data.byCashier ?? []).map((c) => (
                  <li key={c.name} className='py-2.5'>
                    <ListRow
                      leading={<EntityAvatar name={c.name || '—'} />}
                      title={c.name || '—'}
                      meta={
                        <>
                          <span className='tabular-nums'>
                            {t('posTicketsCount', { count: toNumber(c.count) })}
                          </span>
                          {/* What a reviewer looks for, only when there is any */}
                          {toNumber(c.discounts) > 0 && (
                            <>
                              <Dot />
                              <span className='tabular-nums'>
                                {t('discount')} {formatEgp(c.discounts)}
                              </span>
                            </>
                          )}
                          {toNumber(c.voids) > 0 && (
                            <>
                              <Dot />
                              <span className='text-destructive tabular-nums'>
                                {t('voids')} {toNumber(c.voids)}
                              </span>
                            </>
                          )}
                          {toNumber(c.refunds) > 0 && (
                            <>
                              <Dot />
                              <span className='text-destructive tabular-nums'>
                                {t('tillRefunds')} {formatEgp(c.refunds)}
                              </span>
                            </>
                          )}
                        </>
                      }
                      trailing={<Money value={c.net} strong />}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className='grid gap-4 lg:grid-cols-2'>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('byCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList
                  items={byCategory.map((c, index) => ({
                    key: String(index),
                    label: c.name ? localized(c.name) : t('uncategorised'),
                    value: c.amount,
                    display: formatEgp(c.amount),
                    hint: `${c.qty}×`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('byItem')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList
                  items={[...(data.byItem ?? [])]
                    .sort((a, b) => toNumber(b.amount) - toNumber(a.amount))
                    .map((i, index) => ({
                      key: String(index),
                      label: localized(i.description),
                      value: toNumber(i.amount),
                      display: formatEgp(i.amount),
                      hint: `${toNumber(i.qty)}×`,
                    }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </TillPage>
  )
}

type Bar = { label: string; count: number; net: number }

/**
 * When the money came in, as a bar chart: a bar a bucket, the busiest at
 * full strength and named under the title, the rest softer; tapped or
 * hovered, a bar says its takings and its bills.
 */
function Bars({ title, rows }: { title: string; rows: Bar[] }) {
  const t = useT()
  const peak = rows.reduce<Bar | null>(
    (best, r) => (r.net > (best?.net ?? 0) ? r : best),
    null
  )
  const config = {
    net: { label: t('net'), color: 'var(--chart-1)' },
  } satisfies ChartConfig
  return (
    <Card className='gap-2'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {peak && (
          <CardDescription>
            {t('busiestAt', { when: peak.label })}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className='px-2 sm:px-6'>
        <ChartContainer config={config} className='aspect-auto h-36 w-full'>
          <BarChart data={rows} margin={{ top: 4, left: 0, right: 0, bottom: 0 }}>
            <XAxis
              dataKey='label'
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              minTickGap={4}
              fontSize={10}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(value, _name, item) => (
                    <div className='flex w-full justify-between gap-4'>
                      <span className='font-medium tabular-nums'>
                        {formatEgp(Number(value))}
                      </span>
                      <span className='text-muted-foreground tabular-nums'>
                        {t('posTicketsCount', {
                          count: Number(item.payload?.count ?? 0),
                        })}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Bar dataKey='net' radius={[3, 3, 0, 0]}>
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill='var(--color-net)'
                  fillOpacity={r === peak ? 1 : 0.45}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
