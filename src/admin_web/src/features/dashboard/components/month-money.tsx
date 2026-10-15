import { useQuery } from '@tanstack/react-query'
import { Link, type LinkProps } from '@tanstack/react-router'
import { getProfitOptions } from '@/api/finance/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { businessDateOf } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { localDateOf } from '@/lib/zoned-time'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { Money } from '@/components/money'
import {
  formatShare,
  profitBase,
  shareOf,
} from '@/features/finance/profit-math'
import { useTillWindow } from '@/features/till/use-till-window'

/**
 * The month so far, in money: what came in, what it cost, what is left.
 * The owners' view — the profit feed is theirs — as one list down the card:
 * net sales without its VAT (what profit is on), each cost with its share
 * of that, the profit under a line, every row adding up to it; each row
 * opens the page behind it. The month is the business's: the one today's
 * business day is in, in the business's zone.
 */
export function MonthMoney() {
  const t = useT()
  const features = useFeatures()
  const locale = useLocale()
  const { hours, timeZone } = useTillWindow({})
  const today = businessDateOf(new Date(), hours ?? { timeZone })
  const { year, month } = today
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    localDateOf(today)
  )

  const profit = useQuery(
    getProfitOptions({ query: { 'api-version': API_VERSION, year, month } })
  )

  if (profit.isError) {
    return <ErrorState error={profit.error} onRetry={profit.refetch} />
  }

  const p = profit.data
  // Net sales ex VAT, the base profit and every share here is on
  const sales = profitBase(p)
  const costs = toNumber(p?.goods) + toNumber(p?.waste) + toNumber(p?.shrinkage)
  // The same share as the profit page shows, uncapped
  const share = (amount: number) => {
    const formatted = formatShare(shareOf(amount, sales), locale)
    return formatted ? t('ofSales', { share: formatted }) : undefined
  }

  const rows: {
    label: string
    amount: number
    hint?: string
    to?: LinkProps['to']
    /** The feature behind it is on, or it has something in it anyway */
    shown: boolean
  }[] = [
    {
      label: t('goodsWasteShrinkage'),
      amount: costs,
      hint: share(costs),
      to: features.inventory ? '/inventory/reports' : undefined,
      shown: features.inventory || costs > 0,
    },
    {
      label: t('labourCost'),
      amount: toNumber(p?.labour),
      hint: share(toNumber(p?.labour)),
      to: features.payroll ? '/payroll/payslips' : undefined,
      shown: features.payroll || toNumber(p?.labour) > 0,
    },
    {
      label: t('operatingExpenses'),
      amount: toNumber(p?.expenses),
      hint: share(toNumber(p?.expenses)),
      to: '/finance/expenses',
      shown: true,
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
            <span className='flex-1 text-sm font-medium'>
              {t('netSalesExVat')}
            </span>
            <Money value={sales} strong className='text-base' />
          </Link>
          {rows
            .filter((row) => row.shown)
            .map((row) => {
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
              {p.margin != null && (
                <span className='text-muted-foreground block text-xs'>
                  {t('marginOfSales', {
                    share: formatShare(toNumber(p.margin), locale) ?? '—',
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
