import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Download } from 'lucide-react'
import {
  getProfitOptions,
  getProfitTrendOptions,
} from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useBusinessTimeZone } from '@/lib/business-clock'
import { downloadCsv } from '@/lib/csv'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { zonedParts } from '@/lib/zoned-time'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { InfoTip } from '@/components/info-tip'
import { Main } from '@/components/layout/main'
import { MonthSwitcher } from '@/components/month-switcher'
import { PageHeader } from '@/components/page-header'
import { Stat, StatStrip } from '@/components/stat-strip'
import { ProfitTrend } from './components/profit-trend'
import { ProfitWaterfall } from './components/profit-waterfall'
import {
  formatShare,
  profitBase,
  profitStatement,
  shareOf,
} from './profit-math'

const route = getRouteApi('/_authenticated/finance/profit')

/**
 * The month as one statement: what came in, what it cost, what is left.
 * Sales from the till, cost of goods from the storeroom, wages from
 * payroll, the rest from the expense register — and the ratio a business
 * lives by, prime cost (goods + wages) over sales. Profit, margin, the
 * ratios and the partners' shares are all on net sales without its VAT
 * (VAT is the state's, not earned); the statement shows the VAT coming
 * off, so every line adds up to the next.
 */
export function Profit() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const navigate = route.useNavigate()
  const search = route.useSearch()

  // This month by the business's clock, not the browser's
  const timeZone = useBusinessTimeZone()
  const wall = zonedParts(new Date(), timeZone)
  const today = `${wall.year}-${String(wall.month).padStart(2, '0')}`
  const [year, month] = (search.month ?? today).split('-').map(Number)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(y, m - 1, 1)
    )
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })
  const share = (value: number) => formatShare(shareOf(value, base), locale)

  const profit = useQuery(
    getProfitOptions({ query: { 'api-version': API_VERSION, year, month } })
  )
  const trend = useQuery(
    getProfitTrendOptions({ query: { 'api-version': API_VERSION, months: 6 } })
  )

  const p = profit.data
  // What profit and every percentage on the page is on: net sales ex VAT
  const base = profitBase(p)
  const statement = profitStatement(p)
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
        ...statement
          .filter((l) => l.key !== 'profit')
          .flatMap((l) => {
            const signed = l.sign === '−' ? -l.amount : l.amount
            const row: [string, number] = [t(l.labelKey), signed]
            // The expense categories under their total, as on the page
            return l.key === 'expenses'
              ? [
                  ...p.expensesByCategory.map((c): [string, number] => [
                    `${t('operatingExpenses')} · ${localized(c.categoryName)}`,
                    -toNumber(c.total),
                  ]),
                  row,
                ]
              : [row]
          }),
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
        t('netSalesExVat'),
        t('costOfGoods'),
        t('labourCost'),
        t('operatingExpenses'),
        t('profitLabel'),
      ],
      (trend.data ?? []).map((m) => [
        `${m.year}-${String(m.month).padStart(2, '0')}`,
        toNumber(m.netSales),
        profitBase(m),
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
        {opts.sign === '+' && value > 0 ? '+ ' : ''}
        {formatEgp(value)}
        {!opts.indent && share(value) != null && (
          <span className='text-muted-foreground ms-2 text-xs'>
            {share(value)}
          </span>
        )}
      </span>
    </div>
  )

  return (
    <Main>
      <PageHeader
        title={t('navFinanceProfit')}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size='sm' variant='outline' disabled={!p}>
                <Download />
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
        <MonthSwitcher
          monthKey={monthKey}
          onChange={(next) =>
            navigate({ search: (prev) => ({ ...prev, month: next }) })
          }
        />
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
                  ? percent.format(toNumber(p.margin))
                  : undefined
              }
            />
            <Stat
              label={t('netSalesExVat')}
              value={formatEgp(base)}
              hint={
                toNumber(p.netSales) !== base
                  ? `${t('netSales')} ${formatEgp(p.netSales)}`
                  : undefined
              }
            />
            <Stat
              label={
                <span className='inline-flex items-center gap-1'>
                  {t('primeCost')}
                  <InfoTip>{t('primeCostHint')}</InfoTip>
                </span>
              }
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
            />
          </StatStrip>

          {/* Where the money went, before the lines that say it in detail */}
          <Card className='gap-4'>
            <CardHeader>
              <CardTitle>{t('whereTheMoneyWent')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfitWaterfall
                sales={base}
                goods={toNumber(p.goods) + toNumber(p.waste)}
                shrinkage={toNumber(p.shrinkage)}
                labour={toNumber(p.labour)}
                expenses={toNumber(p.expenses)}
                profit={toNumber(p.profit)}
              />
            </CardContent>
          </Card>

          <div className='bg-card divide-border/60 divide-y rounded-xl px-4 shadow-sm'>
            {statement
              .filter((l) => l.key !== 'profit')
              .map((l) => (
                <div key={l.key}>
                  {line(t(l.labelKey), l.amount, {
                    sign:
                      l.sign === '−' ? '−' : l.sign === '+' ? '+' : undefined,
                    strong: l.sign === '=',
                    muted: l.key === 'refunds' || l.key === 'vat',
                  })}
                  {/* The expense categories under their total */}
                  {l.key === 'expenses' &&
                    p.expensesByCategory.map((c) => (
                      <div key={String(c.categoryId)}>
                        {line(localized(c.categoryName), toNumber(c.total), {
                          indent: true,
                          muted: true,
                        })}
                      </div>
                    ))}
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

          {toNumber(p.netVat ?? p.vat) > 0 && (
            <p className='text-muted-foreground text-xs'>
              {t('vatNote', { amount: formatEgp(p.netVat ?? p.vat) })}
            </p>
          )}

          {/* How the month falls to the owners, by the shares set on them */}
          {partnerShares.length > 0 && (
            <div className='space-y-2'>
              <h3 className='text-sm font-medium'>{t('partnersShare')}</h3>
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
        <ProfitTrend
          months={trend.data}
          selected={monthKey}
          onSelect={(next) =>
            navigate({ search: (prev) => ({ ...prev, month: next }) })
          }
        />
      )}
    </Main>
  )
}
