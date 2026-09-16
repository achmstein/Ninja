import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { getRealmRoles } from '@/config/oidc-config'
import { ClipboardCheck } from 'lucide-react'
import { useAuth } from 'react-oidc-context'
import { getProfitOptions } from '@/api/finance/@tanstack/react-query.gen'
import { getVarianceReportOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatDay } from '@/lib/business-day'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { InfoTip } from '@/components/info-tip'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { Stat, StatStrip } from '@/components/stat-strip'
import { useTillWindow } from '@/features/till/use-till-window'
import { getReportColumns } from './report-columns'

const route = getRouteApi('/_authenticated/inventory/reports')

/**
 * Stock over a range of business days at the active branch, read the way
 * the field reads it: what was there, what came in, what selling should
 * have used (through the recipes), what was thrown away, what the counts
 * found, what is left — in money on top, per item below. When the range is
 * one calendar month and the viewer is an owner, the cost of goods is also
 * shown against the month's net sales from Finance. The range in the URL
 * resolves to the branch's DayStart/DayEnd bounds, like the till reports.
 */
export function Reports() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, ready, fromIso, toIso } = useTillWindow(search)
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  const report = useQuery({
    ...getVarianceReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  })
  const data = report.data
  const rows = useMemo(() => data?.rows ?? [], [data])

  // The month the custom range covers exactly, if it does
  const month = useMemo(() => calendarMonthOf(search), [search])
  const profit = useQuery({
    ...getProfitOptions({
      query: {
        'api-version': API_VERSION,
        year: month?.year ?? 0,
        month: month?.month ?? 0,
      },
    }),
    enabled: isOwner && month !== null,
  })
  const netSales = toNumber(profit.data?.netSales)
  const cogsPercent =
    month && isOwner && netSales > 0
      ? Math.round((toNumber(data?.theoreticalValue) / netSales) * 100)
      : null

  const { globalFilter, onGlobalFilterChange, pagination, onPaginationChange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: true, key: 'q' },
    })

  const columns = useMemo(
    () => getReportColumns({ t, localized }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.stockItemId),
    enableSorting: false,
    globalFilterFn: 'includesString',
    state: { pagination, globalFilter: globalFilter ?? '' },
    onPaginationChange,
    onGlobalFilterChange,
  })

  const countVariance = toNumber(data?.countVarianceValue)

  return (
    <>
      <Main>
        <PageHeader title={t('inventoryReports')}>
          <div className='flex flex-wrap items-center gap-2'>
            <DateRangePicker
              search={search}
              dayWindow={dayWindow}
              onChange={(next) =>
                navigate({
                  search: (prev) => ({ ...prev, page: undefined, ...next }),
                })
              }
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                const now = new Date()
                const first = new Date(now.getFullYear(), now.getMonth(), 1)
                const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: undefined,
                    range: 'custom',
                    from: formatDay(first),
                    to: formatDay(last),
                  }),
                })
              }}
            >
              {t('thisMonth')}
            </Button>
          </div>
        </PageHeader>

        {!dayWindow || report.isPending ? (
          <Skeleton className='h-24' />
        ) : (
          <>
            <StatStrip>
              <Stat
                label={t('openingStock')}
                value={formatEgp(data?.openingValue)}
              />
              <Stat
                label={t('purchased')}
                value={formatEgp(data?.receivedValue)}
              />
              <Stat
                label={t('costOfGoodsSold')}
                value={formatEgp(data?.theoreticalValue)}
                hint={cogsPercent !== null ? `${cogsPercent}%` : undefined}
              />
              <Stat
                label={t('waste')}
                value={formatEgp(data?.wastedValue)}
                tone={toNumber(data?.wastedValue) > 0 ? 'negative' : 'default'}
              />
              <Stat
                label={t('closingStock')}
                value={formatEgp(data?.closingValue)}
              />
            </StatStrip>
            <p className='text-muted-foreground flex items-center gap-1.5 text-sm'>
              <ClipboardCheck className='h-4 w-4' />
              {t('countVariance')}
              <span
                className={cn(
                  'text-foreground font-medium tabular-nums',
                  countVariance < 0 && 'text-destructive'
                )}
              >
                {formatEgp(countVariance)}
              </span>
              <InfoTip>{t('countVarianceHint')}</InfoTip>
            </p>
          </>
        )}

        <DataTableToolbar
          table={table}
          searchPlaceholder={t('searchReportPlaceholder')}
        />

        <DataTable
          table={table}
          isLoading={report.isPending}
          emptyMessage={t('noReportRows')}
        />

        <DataTablePagination table={table} />
      </Main>
    </>
  )
}

/** The calendar month a custom range covers from its first to its last day, else null */
function calendarMonthOf(search: {
  range?: string
  from?: string
  to?: string
}): { year: number; month: number } | null {
  if (search.range !== 'custom' || !search.from || !search.to) return null
  const from = new Date(search.from + 'T00:00:00')
  const to = new Date(search.to + 'T00:00:00')
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  const lastDay = new Date(from.getFullYear(), from.getMonth() + 1, 0)
  const isMonth =
    from.getDate() === 1 &&
    to.getFullYear() === from.getFullYear() &&
    to.getMonth() === from.getMonth() &&
    to.getDate() === lastDay.getDate()
  return isMonth
    ? { year: from.getFullYear(), month: from.getMonth() + 1 }
    : null
}
