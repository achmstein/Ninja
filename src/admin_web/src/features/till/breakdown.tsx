import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import type { LocalizedText } from '@/api/catalog'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { getBreakdownReportOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ErrorState } from '@/components/error-state'
import { TillPage } from './till-page'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/breakdown')

// A Sunday, so weekday n is this plus n days
const SUNDAY = Date.UTC(2023, 0, 1)

/**
 * The window cut four ways: when the money came in (hour, weekday), who
 * took it, and what sold. Hours and weekdays are in this browser's clock,
 * which is the café's. No chart library: a bar is a div.
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
        <div className='grid gap-6'>
          <Bars
            title={t('byHour')}
            rows={(data.byHour ?? []).map((h) => ({
              label: String(toNumber(h.hour)),
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
          <section className='grid gap-2'>
            <h2 className='text-sm font-semibold'>{t('byCashier')}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cashier')}</TableHead>
                  <TableHead className='text-end'>{t('tillTickets')}</TableHead>
                  <TableHead className='text-end'>{t('net')}</TableHead>
                  <TableHead className='text-end'>{t('discount')}</TableHead>
                  <TableHead className='text-end'>{t('voids')}</TableHead>
                  <TableHead className='text-end'>{t('tillRefunds')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.byCashier ?? []).map((c) => (
                  <TableRow key={c.name}>
                    <TableCell>{c.name || '—'}</TableCell>
                    <Num>{toNumber(c.count)}</Num>
                    <Num>{formatEgp(c.net)}</Num>
                    <Num muted={toNumber(c.discounts) === 0}>
                      {formatEgp(c.discounts)}
                    </Num>
                    <Num muted={toNumber(c.voids) === 0}>
                      {toNumber(c.voids)}
                    </Num>
                    <Num muted={toNumber(c.refunds) === 0}>
                      {formatEgp(c.refunds)}
                    </Num>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <section className='grid gap-2'>
            <h2 className='text-sm font-semibold'>{t('byCategory')}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead className='text-end'>{t('qty')}</TableHead>
                  <TableHead className='text-end'>{t('net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byCategory.map((c, index) => (
                  <TableRow key={index}>
                    <TableCell className={cn(!c.name && 'text-muted-foreground')}>
                      {c.name ? localized(c.name) : t('uncategorised')}
                    </TableCell>
                    <Num>{c.qty}</Num>
                    <Num>{formatEgp(c.amount)}</Num>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <section className='grid gap-2'>
            <h2 className='text-sm font-semibold'>{t('byItem')}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('item')}</TableHead>
                  <TableHead className='text-end'>{t('qty')}</TableHead>
                  <TableHead className='text-end'>{t('tillTickets')}</TableHead>
                  <TableHead className='text-end'>{t('net')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.byItem ?? []).map((i, index) => (
                  <TableRow key={index}>
                    <TableCell>{localized(i.description)}</TableCell>
                    <Num>{toNumber(i.qty)}</Num>
                    <Num>{toNumber(i.tickets)}</Num>
                    <Num>{formatEgp(i.amount)}</Num>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}
    </TillPage>
  )
}

function Num({
  children,
  muted,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <TableCell
      className={cn('text-end tabular-nums', muted && 'text-muted-foreground')}
    >
      {children}
    </TableCell>
  )
}

type Bar = { label: string; count: number; net: number }

/** One bar per bucket, the tallest filling the height; the value on hover. */
function Bars({ title, rows }: { title: string; rows: Bar[] }) {
  const max = Math.max(0, ...rows.map((r) => r.net))
  return (
    <section className='grid gap-2'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      <div className='flex h-28 items-end gap-1'>
        {rows.map((r) => (
          <div
            key={r.label}
            className='flex min-w-0 flex-1 flex-col items-center justify-end gap-1 self-stretch'
            title={`${formatEgp(r.net)} · ${r.count}`}
          >
            <div
              className={cn(
                'w-full rounded-sm',
                r.net > 0 ? 'bg-primary' : 'bg-muted'
              )}
              style={{
                height: `${max > 0 ? Math.max((r.net / max) * 100, r.net > 0 ? 3 : 2) : 2}%`,
              }}
            />
            <span className='text-muted-foreground truncate text-[10px] tabular-nums'>
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
