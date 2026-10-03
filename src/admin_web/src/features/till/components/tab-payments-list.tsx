import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type TabPaymentView } from '@/api/sales'
import { getTabPaymentsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  useLanguage,
  useLocale,
  useT,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { dayHeading, dayKey } from '@/lib/when'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  createAppColumnHelper,
  dataTableFeatures,
  type AppRow,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { When } from '@/components/when'
import { useTillWindow } from '../use-till-window'
import { TenderBadge } from './tender-badge'

const route = getRouteApi('/_authenticated/till/')

const columnHelper = createAppColumnHelper<TabPaymentView>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

/**
 * Who paid against their tab and how much, grouped by day: the customer
 * (with the slip and time under them), how, and the amount.
 */
function getTabPaymentColumns({ t }: { t: Translate }) {
  return columnHelper.columns([
    columnHelper.accessor('customerName', {
      id: 'customer',
      header: t('customer'),
      cell: (info) => (
        <div className='flex flex-col leading-tight'>
          <span className='font-medium'>{info.getValue() || t('guest')}</span>
          <span className='text-muted-foreground text-xs tabular-nums'>
            #{toNumber(info.row.original.number)} ·{' '}
            <When value={info.row.original.recordedAt} mode='time' />
          </span>
        </div>
      ),
    }),
    columnHelper.accessor('tender', {
      id: 'tender',
      header: t('tender'),
      cell: (info) => <TenderBadge tender={info.getValue()} />,
    }),
    columnHelper.accessor('amount', {
      meta: { align: 'end' },
      id: 'amount',
      header: t('amount'),
      cell: (info) => <Money value={info.getValue()} strong />,
    }),
  ])
}

function TabPaymentListRow({
  row,
  t,
}: {
  row: AppRow<TabPaymentView>
  t: Translate
}) {
  const slip = row.original
  return (
    <ListRow
      title={slip.customerName || t('guest')}
      meta={
        <>
          <span className='tabular-nums'>#{toNumber(slip.number)}</span>
          <Dot />
          <When value={slip.recordedAt} mode='time' />
        </>
      }
      trailing={<Money value={slip.amount} strong />}
      trailingMeta={<TenderBadge tender={slip.tender} />}
    />
  )
}

/**
 * Every tab payment taken in the report's window — money a customer paid
 * against their account, not a sale. A handful a day, so no filters.
 */
export function TabPaymentsList() {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const slipsQuery = useQuery({
    ...getTabPaymentsOptions({
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    enabled: dayWindow !== null,
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => getTabPaymentColumns({ t }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const rows = slipsQuery.data?.items ?? []
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: Number(slipsQuery.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (slipsQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slipsQuery.data, pageCount])

  return (
    <div className='flex flex-col gap-4'>
      {slipsQuery.isError ? (
        <ErrorState
          error={slipsQuery.error}
          onRetry={() => slipsQuery.refetch()}
        />
      ) : (
        <>
          <DataTable
            table={table}
            isLoading={slipsQuery.isLoading}
            emptyMessage={t('noTabPaymentsInRange')}
            groupBy={{
              key: (row) => dayKey(row.recordedAt),
              label: (key) => dayHeading(key, locale, t),
            }}
            mobileRow={(row) => <TabPaymentListRow row={row} t={t} />}
          />
          <DataTablePagination table={table} />
        </>
      )}
    </div>
  )
}
