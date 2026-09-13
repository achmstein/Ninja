import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  getProfitOptions,
  getProfitTrendOptions,
} from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatDay } from '@/lib/business-day'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { Stat, StatStrip } from '@/components/stat-strip'

const route = getRouteApi('/_authenticated/finance/profit')

/**
 * The month as one statement: what came in, what it cost, what is left.
 * Sales from the till, cost of goods from the storeroom, wages from
 * payroll, the rest from the expense register — and the ratio a café
 * lives by, prime cost (goods + wages) over sales.
 */
export function Profit() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const navigate = route.useNavigate()
  const search = route.useSearch()

  const today = formatDay(new Date())
  const [year, month] = (search.month ?? today.slice(0, 7))
    .split('-')
    .map(Number)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1)
    )
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  const profit = useQuery(
    getProfitOptions({ query: { 'api-version': API_VERSION, year, month } })
  )
  const trend = useQuery(
    getProfitTrendOptions({ query: { 'api-version': API_VERSION, months: 6 } })
  )

  const shiftMonth = (delta: number) => {
    const next = new Date(year, month - 1 + delta, 1)
    navigate({
      search: (prev) => ({
        ...prev,
        month: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
      }),
    })
  }

  const p = profit.data
  const net = toNumber(p?.netSales)
  const partnerShares = p?.partnerShares ?? []
  const sharesTotal = partnerShares.reduce(
    (sum, s) => sum + toNumber(s.percent),
    0
  )

  // The month as one column of numbers, the way an accountant reads it
  const exportMonth = () => {
    if (!p) return
    downloadCsv(
      `profit-${monthKey}`,
      [t('lineItem'), t('amount')],
      [
        [t('salesGross'), toNumber(p.sales)],
        [t('refundsTotal'), -toNumber(p.refunds)],
        [t('netSales'), net],
        [t('costOfGoods'), -toNumber(p.goods)],
        [t('wasteCost'), -toNumber(p.waste)],
        [t('labourCost'), -toNumber(p.labour)],
        ...p.expensesByCategory.map((c) => [
          `${t('operatingExpenses')} · ${localized(c.categoryName)}`,
          -toNumber(c.total),
        ]),
        [t('operatingExpenses'), -toNumber(p.expenses)],
        [t('profitLabel'), toNumber(p.profit)],
        ...partnerShares.map((s) => [
          `${t('partnerShareOf', { name: s.name })} (${toNumber(s.percent)}%)`,
          toNumber(s.amount),
        ]),
      ]
    )
  }

  const exportTrend = () =>
    downloadCsv(
      'profit-trend',
      [
        t('month'),
        t('netSales'),
        t('costOfGoods'),
        t('labourCost'),
        t('operatingExpenses'),
        t('profitLabel'),
      ],
      (trend.data ?? []).map((m) => [
        `${m.year}-${String(m.month).padStart(2, '0')}`,
        toNumber(m.netSales),
        toNumber(m.goods),
        toNumber(m.labour),
        toNumber(m.expenses),
        toNumber(m.profit),
      ])
    )
  const line = (
    label: React.ReactNode,
    value: number,
    opts: {
      sign?: '+' | '−'
      muted?: boolean
      strong?: boolean
      indent?: boolean
    } = {}
  ) => (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-1.5',
        opts.muted && 'text-muted-foreground',
        opts.strong && 'font-semibold',
        opts.indent && 'ps-4 text-sm'
      )}
    >
      <span>{label}</span>
      <span className='tabular-nums'>
        {opts.sign === '−' && value > 0 ? '− ' : ''}
        {formatEgp(value)}
        {net > 0 && !opts.indent && (
          <span className='text-muted-foreground ms-2 text-xs'>
            {percent.format(value / net)}
          </span>
        )}
      </span>
    </div>
  )

  return (
    <Main className='flex flex-col gap-6'>
      <PageHeader
        title={t('navFinanceProfit')}
        description={t('profitSubtitle')}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' disabled={!p}>
                <Download className='me-2 h-4 w-4' />
                {t('exportCsv')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={exportMonth}>
                {t('exportThisMonth', { month: monthName(year, month) })}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={exportTrend}
                disabled={(trend.data?.length ?? 0) === 0}
              >
                {t('exportTrend')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('previousMonth')}
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className='h-4 w-4 rtl:-scale-x-100' />
          </Button>
          <span className='min-w-40 text-center text-sm font-medium'>
            {monthName(year, month)}
          </span>
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('nextMonth')}
            disabled={monthKey >= today.slice(0, 7)}
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className='h-4 w-4 rtl:-scale-x-100' />
          </Button>
        </div>
      </PageHeader>

      {profit.isError ? (
        <ErrorState error={profit.error} onRetry={profit.refetch} />
      ) : !p ? (
        <Skeleton className='h-64' />
      ) : (
        <>
          <StatStrip>
            <Stat
              label={t('profitLabel')}
              value={formatEgp(p.profit)}
              tone={toNumber(p.profit) < 0 ? 'negative' : 'positive'}
              hint={
                p.margin != null
                  ? t('marginOfSales', {
                      pct: percent.format(toNumber(p.margin)),
                    })
                  : undefined
              }
            />
            <Stat label={t('netSales')} value={formatEgp(p.netSales)} />
            <Stat
              label={t('primeCost')}
              value={
                p.primeCostRatio != null
                  ? percent.format(toNumber(p.primeCostRatio))
                  : '—'
              }
              tone={
                p.primeCostRatio != null && toNumber(p.primeCostRatio) > 0.65
                  ? 'warning'
                  : 'default'
              }
              hint={t('primeCostHint')}
            />
          </StatStrip>

          <div className='divide-y rounded-lg border px-4'>
            {line(t('salesGross'), toNumber(p.sales))}
            {toNumber(p.refunds) > 0 &&
              line(t('refundsTotal'), toNumber(p.refunds), {
                sign: '−',
                muted: true,
              })}
            {line(t('netSales'), net, { strong: true })}
            {line(t('costOfGoods'), toNumber(p.goods), { sign: '−' })}
            {toNumber(p.waste) > 0 &&
              line(t('wasteCost'), toNumber(p.waste), { sign: '−' })}
            {line(t('labourCost'), toNumber(p.labour), { sign: '−' })}
            {line(t('operatingExpenses'), toNumber(p.expenses), { sign: '−' })}
            {p.expensesByCategory.map((c) => (
              <div key={String(c.categoryId)}>
                {line(localized(c.categoryName), toNumber(c.total), {
                  indent: true,
                  muted: true,
                })}
              </div>
            ))}
            <div
              className={cn(
                'flex items-baseline justify-between gap-4 py-2 text-lg font-semibold',
                toNumber(p.profit) < 0 && 'text-destructive'
              )}
            >
              <span>{t('profitLabel')}</span>
              <span className='tabular-nums'>{formatEgp(p.profit)}</span>
            </div>
          </div>

          {toNumber(p.vat) > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('vatNote', { amount: formatEgp(p.vat) })}
            </p>
          )}

          {/* How the month falls to the owners, by the shares set on them */}
          {partnerShares.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-sm font-semibold'>{t('partnersShare')}</h3>
              <div className='divide-y rounded-lg border px-4 text-sm'>
                {partnerShares.map((s) => (
                  <div
                    key={String(s.partnerId)}
                    className='flex items-baseline justify-between gap-4 py-1.5'
                  >
                    <span>
                      {s.name}
                      <span className='text-muted-foreground ms-2 text-xs'>
                        {percent.format(toNumber(s.percent) / 100)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'tabular-nums',
                        toNumber(s.amount) < 0 && 'text-destructive'
                      )}
                    >
                      {formatEgp(s.amount)}
                    </span>
                  </div>
                ))}
              </div>
              {Math.abs(sharesTotal - 100) > 0.01 && (
                <p className='text-warning text-xs'>
                  {t('sharesNotWhole', { pct: String(sharesTotal) })}
                </p>
              )}
            </div>
          )}
        </>
      )}

      {trend.data && trend.data.length > 1 && (
        <div className='overflow-x-auto rounded-lg border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('month')}</TableHead>
                <TableHead className='text-end'>{t('netSales')}</TableHead>
                <TableHead className='text-end'>{t('costOfGoods')}</TableHead>
                <TableHead className='text-end'>{t('labourCost')}</TableHead>
                <TableHead className='text-end'>
                  {t('operatingExpenses')}
                </TableHead>
                <TableHead className='text-end'>{t('profitLabel')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trend.data.map((m) => (
                <TableRow
                  key={`${m.year}-${m.month}`}
                  className={cn(
                    'cursor-pointer',
                    toNumber(m.year) === year &&
                      toNumber(m.month) === month &&
                      'bg-muted/40'
                  )}
                  onClick={() =>
                    navigate({
                      search: (prev) => ({
                        ...prev,
                        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
                      }),
                    })
                  }
                >
                  <TableCell>
                    {monthName(toNumber(m.year), toNumber(m.month))}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {formatEgp(m.netSales)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {formatEgp(m.goods)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {formatEgp(m.labour)}
                  </TableCell>
                  <TableCell className='text-end tabular-nums'>
                    {formatEgp(m.expenses)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-end font-semibold tabular-nums',
                      toNumber(m.profit) < 0 && 'text-destructive'
                    )}
                  >
                    {formatEgp(m.profit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Main>
  )
}
