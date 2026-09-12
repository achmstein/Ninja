import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type RefundSummary } from '@/api/sales'
import { getRefundsOptions } from '@/api/sales/@tanstack/react-query.gen'
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
import { TicketSheet } from './ticket-sheet'

const route = getRouteApi('/_authenticated/till/')

const columnHelper = createAppColumnHelper<RefundSummary>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function getRefundColumns({ t, locale }: { t: Translate; locale: string }) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return columnHelper.columns([
    columnHelper.accessor('number', {
      id: 'number',
      header: t('creditNoteHash'),
      cell: (info) => (
        <span className='font-medium tabular-nums'>
          #{toNumber(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('refundedAt', {
      id: 'time',
      header: t('time'),
      cell: (info) => {
        const value = info.getValue()
        return value ? (
          <span className='tabular-nums'>
            {dateTime.format(new Date(value))}
          </span>
        ) : (
          '—'
        )
      },
    }),
    columnHelper.accessor('receiptNumber', {
      id: 'receipt',
      header: t('receiptHash'),
      cell: (info) => (
        <span className='tabular-nums'>#{toNumber(info.getValue())}</span>
      ),
    }),
    columnHelper.accessor('shiftId', {
      id: 'shift',
      header: t('shiftHash'),
      cell: (info) => {
        const value = info.getValue()
        return value != null ? (
          <span className='tabular-nums'>#{toNumber(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
      },
    }),
    columnHelper.accessor('tender', {
      id: 'tender',
      header: t('tender'),
      cell: (info) => <TenderBadge tender={info.getValue()} />,
    }),
    columnHelper.accessor('customerName', {
      id: 'customer',
      header: t('customer'),
      cell: (info) => info.getValue() || '—',
    }),
    // The reason is what a reviewer reads first: give it room to wrap
    columnHelper.accessor('reason', {
      id: 'reason',
      header: t('reason'),
      cell: (info) => (
        <span className='block min-w-[16rem] whitespace-normal'>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('refundedBy', {
      id: 'by',
      header: t('byColumn'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('lineCount', {
      id: 'lines',
      header: () => <div className='text-end'>{t('lines')}</div>,
      cell: (info) => (
        <div className='text-end tabular-nums'>{toNumber(info.getValue())}</div>
      ),
    }),
    columnHelper.accessor('amount', {
      id: 'amount',
      header: () => <div className='text-end'>{t('amount')}</div>,
      cell: (info) => (
        <div className='text-destructive text-end font-medium tabular-nums'>
          −{formatEgp(info.getValue())}
        </div>
      ),
    }),
  ])
}

/**
 * Credit notes issued in the report's window, newest first, with the
 * reason in full and the shift each landed in. A row opens the ticket the
 * money went back from, where the refunded lines are listed.
 */
export function RefundsList() {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const refundsQuery = useQuery({
    ...getRefundsOptions({
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
    () => getRefundColumns({ t, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const rows = refundsQuery.data?.items ?? []
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
    rowCount: Number(refundsQuery.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (refundsQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refundsQuery.data, pageCount])

  return (
    <>
      <div className='flex flex-col gap-4'>
        {refundsQuery.isError ? (
          <ErrorState
            error={refundsQuery.error}
            onRetry={() => refundsQuery.refetch()}
          />
        ) : (
          <>
            <DataTable
              table={table}
              isLoading={refundsQuery.isLoading}
              emptyMessage={t('noRefundsInRange')}
              onRowClick={(row) =>
                setSelectedTicketId(toNumber(row.original.ticketId))
              }
            />
            <DataTablePagination table={table} />
          </>
        )}
      </div>

      <TicketSheet
        ticketId={selectedTicketId}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null)
        }}
      />
    </>
  )
}
