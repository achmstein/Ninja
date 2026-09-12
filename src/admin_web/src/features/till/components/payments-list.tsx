import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type PaymentRow } from '@/api/sales'
import { getPaymentsOptions } from '@/api/sales/@tanstack/react-query.gen'
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DataTable,
  DataTablePagination,
  createAppColumnHelper,
  dataTableFeatures,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { useTillWindow } from '../use-till-window'
import { TENDERS } from './tender'
import { TenderBadge } from './tender-badge'
import { TicketSheet } from './ticket-sheet'
import { ticketTitle } from './ticket-title'

const route = getRouteApi('/_authenticated/till/')

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
 * Every payment taken on a settled ticket in the report's window, one
 * tender at a time or all of them. A row opens the bill it paid.
 */
export function PaymentsList() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
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

  const tender = TENDERS.find((item) => String(item.value) === search.tender)

  const paymentsQuery = useQuery({
    ...getPaymentsOptions({
      query: {
        'api-version': API_VERSION,
        from: fromIso,
        to: toIso,
        tender: tender?.value,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    enabled: dayWindow !== null,
    placeholderData: keepPreviousData,
  })

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
    // A ticket can carry several payments, so the key includes when it was taken
    getRowId: (row, index) => `${row.ticketId}-${row.recordedAt}-${index}`,
    enableSorting: false,
    manualPagination: true,
    manualFiltering: true,
    rowCount: Number(paymentsQuery.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (paymentsQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsQuery.data, pageCount])

  return (
    <>
      <div className='flex flex-col gap-4'>
        <ToggleGroup
          type='single'
          variant='outline'
          size='sm'
          value={search.tender ?? 'all'}
          onValueChange={(value) =>
            navigate({
              search: (prev) => ({
                ...prev,
                page: undefined,
                tender: value && value !== 'all' ? value : undefined,
              }),
            })
          }
          aria-label={t('tender')}
        >
          <ToggleGroupItem value='all' className='px-3'>
            {t('allTenders')}
          </ToggleGroupItem>
          {TENDERS.map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={String(item.value)}
              className='px-3'
            >
              {t(item.labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {paymentsQuery.isError ? (
          <ErrorState
            error={paymentsQuery.error}
            onRetry={() => paymentsQuery.refetch()}
          />
        ) : (
          <>
            <DataTable
              table={table}
              isLoading={paymentsQuery.isLoading}
              emptyMessage={t('noPaymentsInRange')}
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
