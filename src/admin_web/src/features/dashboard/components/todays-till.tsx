import { Link } from '@tanstack/react-router'
import { type RangeReport } from '@/api/sales'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { SegmentedBar } from '@/components/segmented-bar'
import { formatEgp } from '@/features/orders/status'
import { tendersFor } from '@/features/till/components/tender'

type TodaysTillProps = {
  report: RangeReport | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/**
 * The business day's till at a glance: how it was paid as a bar, and the
 * lines that explain the rest (discounts, refunds, tab payments, what the
 * "goes well with" suggestions sold), each only when there is any. The net
 * itself is the dashboard's first card, so it is not said twice. Every line
 * links to the till page behind it.
 */
export function TodaysTill({
  report,
  isLoading,
  error,
  onRetry,
}: TodaysTillProps) {
  const t = useT()
  const features = useFeatures()

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  const tenderTotals = new Map(
    (report?.tenderTotals ?? []).map((row) => [row.tender, row])
  )
  const segments = tendersFor(
    features.onlinePayments,
    Number(tenderTotals.get('Online')?.amount ?? 0) > 0,
    Number(tenderTotals.get('Talabat')?.amount ?? 0) > 0
  ).map(({ name, value, labelKey }) => {
    const row = tenderTotals.get(name)
    const amount = Number(row?.amount ?? 0)
    return {
      key: name,
      label: t(labelKey),
      value: amount,
      display: formatEgp(amount),
      hint: t('posTicketsCount', { count: Number(row?.count ?? 0) }),
      to: '/till' as const,
      search: { view: 'payments' as const, tender: String(value) },
    }
  })

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
      hint: t('posTicketsCount', { count: Number(report?.refundCount ?? 0) }),
      to: '/till',
      search: { view: 'refunds' },
    },
    {
      key: 'tabPayments',
      label: t('tabPayments'),
      value: formatEgp(report?.tabPayments),
      amount: Number(report?.tabPayments ?? 0),
      hint: t('posTicketsCount', {
        count: Number(report?.tabPaymentCount ?? 0),
      }),
      to: '/till',
      search: { view: 'payments', tender: '3' },
    },
  ]
  // Tab payments are a tabs figure; what suggestions sold shows once they sold something
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
  const lines = allLines.filter(
    (line) => (line.key !== 'tabPayments' || features.tabs) && line.amount !== 0
  )

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
          <SegmentedBar segments={segments} />
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
