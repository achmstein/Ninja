import { type DayWindow } from '@/lib/business-day'
import { useT } from '@/lib/i18n'
import { type RangeSearch } from '@/lib/search-schemas'
import { DateRangePicker } from '@/components/date-range-picker'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { PageTabs } from '@/components/page-tabs'

type TillTab = 'report' | 'breakdown' | 'shifts'

type TillPageProps = {
  tab: TillTab
  search: RangeSearch
  dayWindow: DayWindow | null
  defaultPreset?: 'today' | 'all'
  onRangeChange: (next: RangeSearch) => void
  /** Beside the range picker: the receipt lookup on the report */
  headerExtra?: React.ReactNode
  children: React.ReactNode
}

/**
 * The till's back office as one page: the report for a range of business
 * days, with every list behind a number opening under it, and the shifts.
 * The picked range travels between the two tabs.
 */
export function TillPage({
  tab,
  search,
  dayWindow,
  defaultPreset = 'today',
  onRangeChange,
  headerExtra,
  children,
}: TillPageProps) {
  const t = useT()
  const range = { range: search.range, from: search.from, to: search.to }
  return (
    <Main>
      <PageHeader title={t('navTill')}>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <PageTabs
            value={tab}
            tabs={[
              {
                value: 'report',
                label: t('tillReport'),
                to: '/till',
                search: range,
              },
              {
                value: 'breakdown',
                label: t('tillBreakdown'),
                to: '/till/breakdown',
                search: range,
              },
              {
                value: 'shifts',
                label: t('tillShifts'),
                to: '/till/shifts',
                search: range,
              },
            ]}
          />
          <div className='flex flex-wrap items-center gap-2'>
            {headerExtra}
            <DateRangePicker
              search={search}
              dayWindow={dayWindow}
              defaultPreset={defaultPreset}
              onChange={onRangeChange}
            />
          </div>
        </div>
      </PageHeader>
      {children}
    </Main>
  )
}
