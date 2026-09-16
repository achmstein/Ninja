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
import { formatEgp, toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  createAppColumnHelper,
  dataTableFeatures,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { useTillWindow } from '../use-till-window'
import { TenderBadge } from './tender-badge'

const route = getRouteApi('/_authenticated/till/')

const columnHelper = createAppColumnHelper<TabPaymentView>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function getTabPaymentColumns({ t, locale }: { t: Translate; locale: string }) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return columnHelper.columns([
    columnHelper.accessor('recordedAt', {
      meta: { align: 'end' },
      id: 'time',
      header: t('time'),
      cell: (info) => (
        <span className='tabular-nums'>
          {dateTime.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.accessor('number', {
      meta: { align: 'end' },
      id: 'number',
      header: t('slipHash'),
      cell: (info) => (
        <span className='font-medium tabular-nums'>
          #{toNumber(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('customerName', {
      id: 'customer',
      header: t('customer'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('tender', {
      id: 'tender',
      header: t('tender'),
      cell: (info) => <TenderBadge tender={info.getValue()} />,
    }),
    columnHelper.accessor('recordedBy', {
      id: 'by',
      header: t('byColumn'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('amount', {
      meta: { align: 'end' },
      id: 'amount',
      header: () => <div className='text-end'>{t('amount')}</div>,
      cell: (info) => (
        <div className='text-end font-medium tabular-nums'>
          {formatEgp(info.getValue())}
        </div>
      ),
    }),
  ])
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
    () => getTabPaymentColumns({ t, locale }),
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
          />
          <DataTablePagination table={table} />
        </>
      )}
    </div>
  )
}
