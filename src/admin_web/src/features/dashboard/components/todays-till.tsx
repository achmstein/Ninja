import { Link } from '@tanstack/react-router'
import { type RangeReport } from '@/api/sales'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { SegmentedBar } from '@/components/segmented-bar'
import { Stat } from '@/components/stat-strip'
import { formatEgp } from '@/features/orders/status'
import { tendersFor } from '@/features/till/components/tender'

type TodaysTillProps = {
  report: RangeReport | undefined
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/**
 * The business day's till at a glance: net as the one big number, the
 * tender split as a bar, and the lines that explain the rest (discounts,
 * refunds, tab payments). Every line links to the till page behind it.
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

  const net = Number(report?.net ?? 0)
  const tenderTotals = new Map(
    (report?.tenderTotals ?? []).map((row) => [row.tender, row])
  )
  const segments = tendersFor(
    features.onlinePayments,
    Number(tenderTotals.get('Online')?.amount ?? 0) > 0
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
    hint?: string
    to: '/till'
    search?: Record<string, unknown>
  }[] = [
    {
      key: 'discounts',
      label: t('discountsTotal'),
      value: formatEgp(report?.discounts),
      to: '/till',
    },
    {
      key: 'refunds',
      label: t('refundsTotal'),
      value: `−${formatEgp(report?.refunds)}`,
      hint: t('posTicketsCount', { count: Number(report?.refundCount ?? 0) }),
      to: '/till',
      search: { view: 'refunds' },
    },
    {
      key: 'tabPayments',
      label: t('tabPayments'),
      value: formatEgp(report?.tabPayments),
      hint: t('posTicketsCount', {
        count: Number(report?.tabPaymentCount ?? 0),
      }),
      to: '/till',
      search: { view: 'payments', tender: '3' },
    },
  ]
  // Tab payments are a tabs figure
  const lines = allLines.filter(
    (line) => line.key !== 'tabPayments' || features.tabs
  )

  return (
    <section className='flex flex-col gap-5'>
      <div className='flex items-start justify-between gap-4'>
        <Stat
          size='hero'
          label={t('todaysTill')}
          value={formatEgp(net)}
          hint={t('posTicketsCount', {
            count: Number(report?.ticketsSettled ?? 0),
          })}
          loading={isLoading}
        />
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
