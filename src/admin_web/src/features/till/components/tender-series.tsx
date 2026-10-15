import { type RangeReport } from '@/api/sales'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { SegmentedBar } from '@/components/segmented-bar'
import { tenderSeries } from '../report-math'

type TenderSeriesViewProps = {
  report: RangeReport | undefined
  /** Search params a bills segment opens, given the tender's number */
  billsSearch: (tender: number) => Record<string, unknown>
  /** Search params a tab-payments segment opens */
  tabsSearch: (tender: number) => Record<string, unknown>
}

/**
 * How the money came in, as two labelled series that never mix: what the
 * bills were paid with (adding up to gross sales; cash is what stayed in the
 * drawer after the change), and the tab payments, money paid off customers'
 * accounts, which is not a sale. The dashboard and the till page both show
 * this, the same way.
 */
export function TenderSeriesView({
  report,
  billsSearch,
  tabsSearch,
}: TenderSeriesViewProps) {
  const t = useT()
  const features = useFeatures()
  const series = tenderSeries(report, features.onlinePayments)
  const change = toNumber(report?.changeGiven)

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-baseline justify-between gap-2 text-xs'>
          <span className='text-muted-foreground font-medium'>
            {t('billsByTender')}
          </span>
          <span className='tabular-nums'>{formatEgp(series.billsTotal)}</span>
        </div>
        <SegmentedBar
          segments={series.bills.map((row) => ({
            key: row.name,
            label: t(row.labelKey),
            value: row.amount,
            display: formatEgp(row.amount),
            hint: t('paymentsCount', { count: row.count }),
            to: '/till' as const,
            search: billsSearch(row.value),
          }))}
        />
        {change > 0 && (
          <p className='text-muted-foreground text-xs tabular-nums'>
            {t('cashAfterChangeNote', { amount: formatEgp(change) })}
          </p>
        )}
      </div>

      {features.tabs && series.tabs.length > 0 && (
        <div className='flex flex-col gap-2'>
          <div className='flex items-baseline justify-between gap-2 text-xs'>
            <span className='text-muted-foreground font-medium'>
              {t('tabPaymentsByTender')}
            </span>
            <span className='tabular-nums'>{formatEgp(series.tabsTotal)}</span>
          </div>
          <SegmentedBar
            segments={series.tabs.map((row) => ({
              key: row.name,
              label: t(row.labelKey),
              value: row.amount,
              display: formatEgp(row.amount),
              hint: t('tabPaymentsCount', { count: row.count }),
              to: '/till' as const,
              search: tabsSearch(row.value),
            }))}
          />
        </div>
      )}
    </div>
  )
}
