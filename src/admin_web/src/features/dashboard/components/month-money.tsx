import { useQuery } from '@tanstack/react-query'
import { Link, type LinkProps } from '@tanstack/react-router'
import { getProfitOptions } from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { Money } from '@/components/money'

/**
 * The month so far, in money: what came in, what it cost, what is left.
 * The owners' view — the profit feed is theirs — as one list down the card:
 * sales, each cost with its share of sales, the profit under a line; each
 * row opens the page behind it.
 */
export function MonthMoney() {
  const t = useT()
  const features = useFeatures()
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
  const sales = toNumber(p?.netSales)
  const costs = toNumber(p?.goods) + toNumber(p?.waste)
  // A share of sales says something only while it is one: 1,615% of a quiet month's sales says nothing
  const share = (amount: number) =>
    sales > 0 && amount / sales <= 1
      ? t('ofSales', { share: percent.format(amount / sales) })
      : undefined

  const rows: {
    label: string
    amount: number
    hint?: string
    to?: LinkProps['to']
  }[] = [
    {
      label: t('costOfGoods'),
      amount: costs,
      hint: share(costs),
      to: features.inventory ? '/inventory/reports' : undefined,
    },
    {
      label: t('labourCost'),
      amount: toNumber(p?.labour),
      hint: share(toNumber(p?.labour)),
      to: features.payroll ? '/payroll/payslips' : undefined,
    },
    {
      label: t('operatingExpenses'),
      amount: toNumber(p?.expenses),
      hint: share(toNumber(p?.expenses)),
      to: '/finance/expenses',
    },
  ]

  const line =
    'hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors'

  return (
    <section className='flex flex-col gap-3'>
      <div className='flex items-baseline justify-between gap-4'>
        <h2 className='text-sm font-semibold'>
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
        <Skeleton className='h-56 rounded-xl' />
      ) : (
        // One list from what came in to what is left: sales, what it cost, then the profit under a line
        <div className='bg-card divide-border/60 divide-y overflow-hidden rounded-xl shadow-sm'>
          <Link
            to='/finance/profit'
            search={{ month: monthKey }}
            className={line}
          >
            <span className='flex-1 text-sm font-medium'>{t('netSales')}</span>
            <Money value={sales} strong className='text-base' />
          </Link>
          {rows.map((row) => {
            const body = (
              <>
                <span className='min-w-0 flex-1'>
                  <span className='text-muted-foreground block text-sm'>
                    {row.label}
                  </span>
                  {row.hint && (
                    <span className='text-muted-foreground/80 block text-xs'>
                      {row.hint}
                    </span>
                  )}
                </span>
                <Money value={-row.amount} dashZero className='text-sm' />
              </>
            )
            return row.to ? (
              <Link
                key={row.label}
                to={row.to}
                search={{ month: monthKey }}
                className={line}
              >
                {body}
              </Link>
            ) : (
              <div key={row.label} className={line}>
                {body}
              </div>
            )
          })}
          <Link
            to='/finance/profit'
            search={{ month: monthKey }}
            className={cn(line, 'bg-muted/30')}
          >
            <span className='min-w-0 flex-1'>
              <span className='block text-sm font-semibold'>
                {t('profitLabel')}
              </span>
              {p.margin != null && Math.abs(toNumber(p.margin)) <= 1 && (
                <span className='text-muted-foreground block text-xs'>
                  {t('marginOfSales', {
                    share: percent.format(toNumber(p.margin)),
                  })}
                </span>
              )}
            </span>
            <Money value={p.profit} tone='auto' strong className='text-lg' />
          </Link>
        </div>
      )}
    </section>
  )
}
