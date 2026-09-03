import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  useTable,
  type ColumnFiltersState,
  type OnChangeFn,
} from '@tanstack/react-table'
import { type PaymentRow } from '@/api/sales'
import {
  getPaymentsOptions,
  getRangeReportOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  createAppColumnHelper,
  dataTableFeatures,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RangeToolbar } from './components/range-toolbar'
import { StatTile } from './components/stat-tile'
import { TENDERS } from './components/tender'
import { TenderBadge } from './components/tender-badge'
import { TicketSheet } from './components/ticket-sheet'
import { ticketTitle } from './components/ticket-title'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/payments')

const columnHelper = createAppColumnHelper<PaymentRow>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function getPaymentColumns({
  t,
  localized,
  locale,
}: {
  t: Translate
  localized: (
    text: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
  locale: string
}) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return columnHelper.columns([
    columnHelper.accessor('recordedAt', {
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
      cell: (info) => {
        const value = info.getValue()
        return value != null ? (
          <span className='font-medium tabular-nums'>#{toNumber(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
      },
    }),
    columnHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => info.getValue() || '—',
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
    columnHelper.accessor('recordedBy', {
      id: 'by',
      header: t('byColumn'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('amount', {
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
 * Every payment taken on a settled ticket in the window, with the tender
 * totals of the same window above it — the two are cut on the settle, so
 * they reconcile. Read-only; a row opens the bill it paid.
 */
export function TillPayments() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  const {
    pagination,
    onPaginationChange,
    columnFilters,
    onColumnFiltersChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPageSize: 20 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: 'tender', searchKey: 'tender', type: 'array' }],
  })

  const tenderFilter =
    (columnFilters.find((f) => f.id === 'tender')?.value as
      | string[]
      | undefined) ?? []
  const tender = TENDERS.find((item) => item.name === tenderFilter[0])?.value

  // The API takes one tender, so the facet behaves as a single choice: the
  // latest pick replaces the last
  const onTenderChange: OnChangeFn<ColumnFiltersState> = (updater) =>
    onColumnFiltersChange((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      return next.map((filter) =>
        filter.id === 'tender' &&
        Array.isArray(filter.value) &&
        filter.value.length > 1
          ? { ...filter, value: [filter.value[filter.value.length - 1]] }
          : filter
      )
    })

  const paymentsQuery = useQuery({
    ...getPaymentsOptions({
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        tender,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    enabled: dayWindow !== null,
    placeholderData: keepPreviousData,
  })

  const report = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null,
  })
  const tenderTotals = new Map(
    (report.data?.tenderTotals ?? []).map((row) => [row.tender, row])
  )

  const columns = useMemo(
    () => getPaymentColumns({ t, localized, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const rows = paymentsQuery.data?.items ?? []
  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    // A ticket can carry several payments, so the row key is the position
    getRowId: (_row, index) => String(index),
    enableSorting: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: Number(paymentsQuery.data?.totalCount ?? 0),
    state: { pagination, columnFilters },
    onPaginationChange,
    onColumnFiltersChange: onTenderChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (paymentsQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsQuery.data, pageCount])

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('tillPayments')}
          </h1>
          <p className='text-muted-foreground'>{t('tillPaymentsSubtitle')}</p>
        </div>

        <RangeToolbar
          search={search}
          dayWindow={dayWindow}
          onChange={(next) =>
            navigate({
              search: (prev) => ({ ...prev, page: undefined, ...next }),
            })
          }
        />

        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {TENDERS.map(({ name, labelKey }) => {
            const row = tenderTotals.get(name)
            return (
              <StatTile
                key={name}
                label={t(labelKey)}
                value={formatEgp(row?.amount)}
                hint={t('paymentsCount', { count: toNumber(row?.count) })}
              />
            )
          })}
        </div>

        <DataTableToolbar
          table={table}
          showSearch={false}
          filters={[
            {
              columnId: 'tender',
              title: t('tender'),
              options: TENDERS.map((item) => ({
                label: t(item.labelKey),
                value: item.name,
              })),
            },
          ]}
        />

        <DataTable
          table={table}
          isLoading={paymentsQuery.isLoading}
          emptyMessage={t('noPaymentsInRange')}
          onRowClick={(row) =>
            setSelectedTicketId(toNumber(row.original.ticketId))
          }
        />

        <DataTablePagination table={table} />
      </Main>

      <TicketSheet
        ticketId={selectedTicketId}
        onOpenChange={(open) => {
          if (!open) setSelectedTicketId(null)
        }}
      />
    </>
  )
}
