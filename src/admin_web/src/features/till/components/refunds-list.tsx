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
import { TicketSheet } from './ticket-sheet'

const route = getRouteApi('/_authenticated/till/')

const columnHelper = createAppColumnHelper<RefundSummary>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

/** Why, as the row's lead line, with the receipt and customer it came off */
function Reason({ refund, t }: { refund: RefundSummary; t: Translate }) {
  return (
    <span className='flex min-w-0 flex-col leading-tight'>
      <span className='line-clamp-2 whitespace-normal'>
        {refund.reason || '—'}
      </span>
      <span className='text-muted-foreground truncate text-xs'>
        {t('receiptHash')} {toNumber(refund.receiptNumber)}
        {refund.customerName && ` · ${refund.customerName}`}
      </span>
    </span>
  )
}

function Amount({ refund, t }: { refund: RefundSummary; t: Translate }) {
  return (
    <Money
      value={-toNumber(refund.amount)}
      tone='negative'
      strong
      sub={`${toNumber(refund.lineCount)} ${t('lines')}`}
    />
  )
}

/**
 * Five things a refund says, grouped by day so a row needs only its time:
 * the credit note and when, why (with the receipt and customer it came
 * off), who gave it, how the money went back, and how much. The shift is
 * on the ticket the row opens.
 */
function getRefundColumns({ t }: { t: Translate }) {
  return columnHelper.columns([
    columnHelper.accessor('number', {
      id: 'number',
      header: t('creditNoteHash'),
      cell: (info) => (
        <div className='flex flex-col leading-tight'>
          <span className='font-medium tabular-nums'>
            #{toNumber(info.getValue())}
          </span>
          <When
            value={info.row.original.refundedAt}
            mode='time'
            className='text-muted-foreground text-xs'
          />
        </div>
      ),
    }),
    // The reason is what a reviewer reads first: give it room to wrap
    columnHelper.accessor('reason', {
      id: 'reason',
      header: t('reason'),
      meta: { className: 'min-w-[16rem]' },
      cell: (info) => <Reason refund={info.row.original} t={t} />,
    }),
    columnHelper.accessor('refundedBy', {
      id: 'by',
      header: t('byColumn'),
      meta: { emphasis: 'muted' },
      cell: (info) => info.getValue() || '—',
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
      cell: (info) => <Amount refund={info.row.original} t={t} />,
    }),
  ])
}

/** A refund as a phone lists it: why, then the note, time and who; how much over how it went back */
function RefundListRow({
  row,
  t,
}: {
  row: AppRow<RefundSummary>
  t: Translate
}) {
  const refund = row.original
  return (
    <ListRow
      title={<span className='whitespace-normal'>{refund.reason || '—'}</span>}
      meta={
        <>
          <span className='tabular-nums'>#{toNumber(refund.number)}</span>
          <Dot />
          <When value={refund.refundedAt} mode='time' />
          {refund.refundedBy && (
            <>
              <Dot />
              <span className='truncate'>{refund.refundedBy}</span>
            </>
          )}
        </>
      }
      trailing={<Amount refund={refund} t={t} />}
      trailingMeta={<TenderBadge tender={refund.tender} />}
    />
  )
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
    () => getRefundColumns({ t }),
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
              groupBy={{
                key: (row) => dayKey(row.refundedAt),
                label: (key) => dayHeading(key, locale, t),
              }}
              mobileRow={(row) => <RefundListRow row={row} t={t} />}
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
