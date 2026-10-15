import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Bar, BarChart, Cell, XAxis } from 'recharts'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import {
  getBreakdownReportOptions,
  getRangeReportOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
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
import { Skeleton } from '@/components/ui/skeleton'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { RankedList } from '@/components/ranked-list'
import {
  cashierKindKey,
  cashierNetSales,
  categoryRows,
  itemRows,
} from './breakdown-rows'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/breakdown')

// A Sunday, so weekday n is this plus n days
const SUNDAY = Date.UTC(2023, 0, 1)

/**
 * The window cut four ways: when the money came in (hour, weekday), who
 * took it, and what sold. Hours and weekdays are on the business's own
 * clock (its IANA zone, so a day across a clock change is still right).
 * Items and categories are in the money of net sales: what customers paid
 * for them (their share of each bill after the bill discount, service and
 * VAT) less what was refunded; the delivery fee is not an item and has a
 * line of its own. Charts where a shape says it (when), lists where names
 * do (who, what).
 */
export function TillBreakdown() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, timeZone, fromIso, toIso } = useTillWindow(search)

  const report = useQuery({
    ...getBreakdownReportOptions({
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        tz: timeZone,
      },
    }),
    enabled: dayWindow !== null,
  })
  // The till report's own query, usually already cached: the delivery fees
  const range = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
  })
  const deliveryFees = toNumber(range.data?.deliveryFees)

  // The category is Catalog's, joined here: Sales names the item on each
  // line, the menu says which category it is in. A line from before the
  // stamp, or an item no longer on the menu, counts as uncategorised.
  const items = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )
  const soldItems = useMemo(() => itemRows(report.data?.byItem), [report.data])
  const byCategory = useMemo(
    () => categoryRows(soldItems, items.data),
    [soldItems, items.data]
  )

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
                {(data.byCashier ?? []).map((c) => {
                  // The system's own work (a platform, guests paying online,
                  // a rider, an automatic void) is said as what it is
                  const kindKey = c.kind ? cashierKindKey[c.kind] : undefined
                  const title = kindKey ? t(kindKey) : c.name || '—'
                  return (
                    <li key={`${c.kind ?? ''}-${c.name}`} className='py-2.5'>
                      <ListRow
                        leading={<EntityAvatar name={title} />}
                        title={title}
                        meta={
                          <>
                            {kindKey && c.name && (
                              <>
                                <span>{c.name}</span>
                                <Dot />
                              </>
                            )}
                            <span className='tabular-nums'>
                              {t('posTicketsCount', {
                                count: toNumber(c.count),
                              })}
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
                                  {t('voidsCount', {
                                    count: toNumber(c.voids),
                                  })}
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
                        trailing={<Money value={cashierNetSales(c)} strong />}
                      />
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Who took the orders, the call centre's agents among them: only when any bill says */}
          {(data.byTaker ?? []).length > 0 && (
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('byTaker')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className='divide-y'>
                  {(data.byTaker ?? []).map((taker) => (
                    <li key={taker.name} className='py-2.5'>
                      <ListRow
                        leading={<EntityAvatar name={taker.name || '—'} />}
                        title={taker.name || '—'}
                        meta={
                          <span className='tabular-nums'>
                            {t('posTicketsCount', {
                              count: toNumber(taker.count),
                            })}
                          </span>
                        }
                        trailing={<Money value={taker.net} strong />}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className='grid gap-4 lg:grid-cols-2'>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('byCategory')}</CardTitle>
              </CardHeader>
              <CardContent>
                <RankedList
                  items={byCategory.map((c) => ({
                    key: c.id != null ? String(c.id) : 'none',
                    label: c.name ? localized(c.name) : t('uncategorised'),
                    value: c.amount,
                    display: formatEgp(c.amount),
                    hint:
                      c.refundedQty > 0
                        ? `${c.qty}× · ${t('refundedQty', { count: c.refundedQty })}`
                        : `${c.qty}×`,
                  }))}
                />
              </CardContent>
            </Card>
            <Card className='gap-3'>
              <CardHeader>
                <CardTitle>{t('byItem')}</CardTitle>
                <CardDescription>{t('itemsPaidNetOfRefunds')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RankedList
                  items={soldItems.map((i) => ({
                    key: i.key,
                    label: localized(i.description),
                    value: i.amount,
                    display: formatEgp(i.amount),
                    hint:
                      i.refundedQty > 0
                        ? `${i.qty}× · ${t('refundedQty', { count: i.refundedQty })}`
                        : `${i.qty}×`,
                  }))}
                />
                {deliveryFees > 0 && (
                  <div className='text-muted-foreground mt-3 flex justify-between gap-3 border-t pt-2 text-sm'>
                    <span>{t('deliveryFeesNotItems')}</span>
                    <span className='tabular-nums'>
                      {formatEgp(deliveryFees)}
                    </span>
                  </div>
                )}
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
    // What customers paid in the bucket, before refunds
    net: { label: t('grossSales'), color: 'var(--chart-1)' },
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
          <BarChart
            data={rows}
            margin={{ top: 4, left: 0, right: 0, bottom: 0 }}
          >
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
