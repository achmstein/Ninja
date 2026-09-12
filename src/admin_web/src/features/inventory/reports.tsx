import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import {
  ClipboardCheck,
  PackagePlus,
  ReceiptText,
  Trash2,
  Warehouse,
} from 'lucide-react'
import { getUsageReportOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { Main } from '@/components/layout/main'
import { useTillWindow } from '@/features/till/use-till-window'
import { getReportColumns } from './report-columns'

const route = getRouteApi('/_authenticated/inventory/reports')

/**
 * Stock usage over a range of business days at the active branch: what was
 * bought, what selling consumed, what was thrown away, what the counts
 * found, and what is on the shelf now — in money on top, per item below.
 * The range in the URL resolves to the branch's DayStart/DayEnd bounds,
 * the same way the till reports do.
 */
export function Reports() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, ready, fromIso, toIso } = useTillWindow(search)

  const report = useQuery({
    ...getUsageReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  })
  const data = report.data
  const rows = useMemo(() => data?.rows ?? [], [data])

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
      <Main className='flex flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('inventoryReports')}
          </h1>
          <p className='text-muted-foreground'>{t('reportsSubtitle')}</p>
        </div>

        <DateRangePicker
          search={search}
          dayWindow={dayWindow}
          onChange={(next) =>
            navigate({
              search: (prev) => ({ ...prev, page: undefined, ...next }),
            })
          }
        />

        {!dayWindow || report.isPending ? (
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className='h-28' />
            ))}
          </div>
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <StatCard
                label={t('purchased')}
                value={formatEgp(data?.purchasedValue)}
                icon={PackagePlus}
              />
              <StatCard
                label={t('costOfGoodsSold')}
                value={formatEgp(data?.soldValue)}
                icon={ReceiptText}
              />
              <StatCard
                label={t('waste')}
                value={formatEgp(data?.wastedValue)}
                icon={Trash2}
                className={
                  toNumber(data?.wastedValue) > 0 ? 'text-destructive' : ''
                }
              />
              <StatCard
                label={t('stockValueNow')}
                value={formatEgp(data?.stockValue)}
                icon={Warehouse}
              />
            </div>
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

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <Icon className='text-muted-foreground h-4 w-4' />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tabular-nums', className)}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
