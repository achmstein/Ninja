import { Link } from '@tanstack/react-router'
import { type RangeReport } from '@/api/sales'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { formatEgp } from '@/features/orders/status'
import { TenderSeriesView } from '@/features/till/components/tender-series'

type TodaysTillProps = {
  report: RangeReport | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/**
 * The business day's till at a glance: how the bills were paid and, apart,
 * what came in on tab payments (the same two series as the till page), and
 * the lines that explain the rest (discounts, refunds, what the "goes well
 * with" suggestions sold), each only when there is any. Net sales itself is
 * the dashboard's first card, so it is not said twice. Every line links to
 * the till page behind it.
 */
export function TodaysTill({
  report,
  isLoading,
  error,
  onRetry,
}: TodaysTillProps) {
  const t = useT()

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  const allLines: {
    key: string
    label: string
    value: string
    amount: number
    hint?: string
    to: '/till'
    search?: Record<string, unknown>
  }[] = [
    {
      key: 'discounts',
      label: t('discountsTotal'),
      value: formatEgp(report?.discounts),
      amount: Number(report?.discounts ?? 0),
      to: '/till',
    },
    {
      key: 'refunds',
      label: t('refundsTotal'),
      value: formatEgp(-toNumber(report?.refunds)),
      amount: Number(report?.refunds ?? 0),
      hint: t('refundsCount', { count: Number(report?.refundCount ?? 0) }),
      to: '/till',
      search: { view: 'refunds' },
    },
  ]
  // What suggestions sold shows once they sold something
  const suggestedLines = Number(report?.suggestedLines ?? 0)
  if (suggestedLines > 0) {
    allLines.push({
      key: 'suggestions',
      label: t('fromSuggestions'),
      value: formatEgp(report?.suggestedSales),
      amount: Number(report?.suggestedSales ?? 0),
      hint: t('suggestedLinesCount', { count: suggestedLines }),
      to: '/till',
    })
  }
  const lines = allLines.filter((line) => line.amount !== 0)

  return (
    <section className='flex flex-col gap-5'>
      <div className='flex items-start justify-between gap-4'>
        <h2 className='text-sm font-semibold'>{t('todaysTill')}</h2>
        <Link
          to='/till'
          className='text-primary text-sm underline-offset-4 hover:underline'
        >
          {t('viewAll')}
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className='h-32' />
      ) : (
        <>
          <TenderSeriesView
            report={report}
            billsSearch={(tender) => ({
              view: 'payments',
              tender: String(tender),
            })}
            tabsSearch={() => ({ view: 'tab-payments' })}
          />
          <dl className='divide-y text-sm'>
            {lines.map((line) => (
              <div key={line.key}>
                <Link
                  to={line.to}
                  search={line.search}
                  className='hover:bg-accent/50 -mx-2 flex items-center gap-2 rounded-md px-2 py-2 transition-colors'
                >
                  <dt className='flex-1'>{line.label}</dt>
                  {line.hint && (
                    <span className='text-muted-foreground text-xs tabular-nums'>
                      {line.hint}
                    </span>
                  )}
                  <dd className='font-medium tabular-nums'>{line.value}</dd>
                </Link>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  )
}
