import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { type PaymentRow } from '@/api/sales'
import {
  getPaymentsOptions,
  getRangeReportOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { dayHeading, dayKey } from '@/lib/when'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DataTable,
  DataTablePagination,
  createAppColumnHelper,
  type AppRow,
  dataTableFeatures,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { When } from '@/components/when'
import { useTillWindow } from '../use-till-window'
import { TENDERS, tendersFor } from './tender'
import { TenderBadge } from './tender-badge'
import { TicketSheet } from './ticket-sheet'
import { ticketTitle } from './ticket-title'

const route = getRouteApi('/_authenticated/till/')

const columnHelper = createAppColumnHelper<PaymentRow>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

/**
 * Four things a payment says, grouped by day so a row needs only its time:
 * the receipt and when, where and who paid, how, and how much.
 */
function getPaymentColumns({
  t,
  localized,
}: {
  t: Translate
  localized: Localized
}) {
  return columnHelper.columns([
    columnHelper.accessor('receiptNumber', {
      id: 'receipt',
      header: t('receiptHash'),
      cell: (info) => {
        const value = info.getValue()
        return (
          <div className='flex flex-col leading-tight'>
            {value != null && (
              <span className='font-medium tabular-nums'>
                #{toNumber(value)}
              </span>
            )}
            <When
              value={info.row.original.recordedAt}
              mode='time'
              className='text-muted-foreground text-xs'
            />
          </div>
        )
      },
    }),
    columnHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => (
        <div className='flex max-w-64 flex-col leading-tight'>
          <span className='truncate'>{info.getValue()}</span>
          {info.row.original.customerName && (
            <span className='text-muted-foreground truncate text-xs'>
              {info.row.original.customerName}
            </span>
          )}
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

/** A payment as a phone lists it: where, then the receipt, time and who paid; how much over how */
function PaymentListRow({
  row,
  t,
  localized,
}: {
  row: AppRow<PaymentRow>
  t: Translate
  localized: Localized
}) {
  const payment = row.original
  return (
    <ListRow
      title={ticketTitle(payment, localized, t)}
      meta={
        <>
          {payment.receiptNumber != null && (
            <>
              <span className='tabular-nums'>
                #{toNumber(payment.receiptNumber)}
              </span>
              <Dot />
            </>
          )}
          <When value={payment.recordedAt} mode='time' />
          {payment.customerName && (
            <>
              <Dot />
              <span className='truncate'>{payment.customerName}</span>
            </>
          )}
        </>
      }
      trailing={<Money value={payment.amount} strong />}
      trailingMeta={<TenderBadge tender={payment.tender} />}
    />
  )
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
  const features = useFeatures()

  // The report's own query, already in the cache: how many tab payments
  // the filtered tender also took, since the bar above counts both
  const report = useQuery({
    ...getRangeReportOptions({
      query: { 'api-version': API_VERSION, from: fromIso, to: toIso },
    }),
    enabled: dayWindow !== null && tender != null,
  })
  const tabPaymentsByTender =
    tender &&
    report.data?.tabPaymentTenderTotals?.find(
      (row) => row.tender === tender.name
    )

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
    () => getPaymentColumns({ t, localized }),
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
          {tendersFor(
            features.onlinePayments,
            tender?.name === 'Online',
            true
          ).map((item) => (
            <ToggleGroupItem
              key={item.value}
              value={String(item.value)}
              className='px-3'
            >
              {t(item.labelKey)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {tabPaymentsByTender && toNumber(tabPaymentsByTender.count) > 0 && (
          <Link
            to='/till'
            search={{
              ...search,
              view: 'tab-payments',
              tender: undefined,
              page: undefined,
            }}
            className='text-muted-foreground hover:text-foreground -mt-2 text-sm underline-offset-4 hover:underline'
          >
            {t('plusTabPaymentsByTender', {
              count: toNumber(tabPaymentsByTender.count),
              amount: formatEgp(tabPaymentsByTender.amount),
            })}
          </Link>
        )}

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
              groupBy={{
                key: (row) => dayKey(row.recordedAt),
                label: (key) => dayHeading(key, locale, t),
              }}
              mobileRow={(row) => (
                <PaymentListRow row={row} t={t} localized={localized} />
              )}
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
