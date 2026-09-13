import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getProfitOptions } from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { Stat, StatStrip } from '@/components/stat-strip'

/**
 * The month so far, in money: what came in, what it cost, what is left.
 * The owners' view — the profit feed is theirs — one strip under the
 * day's numbers, each cell opening the page behind it.
 */
export function MonthMoney() {
  const t = useT()
  const locale = useLocale()
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    now
  )
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  })

  const profit = useQuery(
    getProfitOptions({ query: { 'api-version': API_VERSION, year, month } })
  )

  if (profit.isError) {
    return <ErrorState error={profit.error} onRetry={profit.refetch} />
  }

  const p = profit.data
  const costs = toNumber(p?.goods) + toNumber(p?.waste)

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between gap-4'>
        <h2 className='text-lg font-semibold tracking-tight'>
          {t('monthMoney', { month: monthLabel })}
        </h2>
        <Link
          to='/finance/profit'
          search={{ month: monthKey }}
          className='text-primary text-sm underline-offset-4 hover:underline'
        >
          {t('viewAll')}
        </Link>
      </div>
      {!p ? (
        <Skeleton className='h-20' />
      ) : (
        <StatStrip>
          <Stat
            label={t('netSales')}
            value={formatEgp(p.netSales)}
            to='/finance/profit'
            search={{ month: monthKey }}
          />
          <Stat
            label={t('costOfGoods')}
            value={formatEgp(costs)}
            hint={
              toNumber(p.netSales) > 0
                ? percent.format(costs / toNumber(p.netSales))
                : undefined
            }
            to='/inventory/reports'
          />
          <Stat
            label={t('labourCost')}
            value={formatEgp(p.labour)}
            hint={
              toNumber(p.netSales) > 0
                ? percent.format(toNumber(p.labour) / toNumber(p.netSales))
                : undefined
            }
            to='/payroll/payslips'
            search={{ month: monthKey }}
          />
          <Stat
            label={t('operatingExpenses')}
            value={formatEgp(p.expenses)}
            to='/finance/expenses'
            search={{ month: monthKey }}
          />
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
            to='/finance/profit'
            search={{ month: monthKey }}
          />
        </StatStrip>
      )}
    </section>
  )
}
