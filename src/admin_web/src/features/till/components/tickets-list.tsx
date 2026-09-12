import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import {
  getOpenTicketsOptions,
  getTicketHistoryOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { ErrorState } from '@/components/error-state'
import { getHistoryColumns, getOpenColumns } from '../ticket-columns'
import { useTillWindow } from '../use-till-window'
import { TICKET_STATUS_SETTLED, TICKET_STATUS_VOIDED } from './tender'
import { TicketSheet } from './ticket-sheet'

const route = getRouteApi('/_authenticated/till/')

type TicketTab = 'settled' | 'open' | 'voided'

const tabs: { value: TicketTab; key: TranslationKey }[] = [
  { value: 'settled', key: 'statusSettled' },
  { value: 'open', key: 'statusOpen' },
  { value: 'voided', key: 'statusVoided' },
]

/**
 * Every bill the branch wrote: settled and voided ones over the report's
 * window (or one bill by receipt number), and the ones still open on the
 * floor with how long they have sat. Read-only — a row opens the ticket.
 */
export function TicketsList() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const tab: TicketTab = search.status ?? 'settled'
  const byReceipt = search.receipt != null
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const { dayWindow, fromIso, toIso } = useTillWindow(search)

  // 30s clock so idle times on the open tab keep moving
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const historyQuery = useQuery({
    ...getTicketHistoryOptions({
      query: {
        'api-version': API_VERSION,
        status: tab === 'voided' ? TICKET_STATUS_VOIDED : TICKET_STATUS_SETTLED,
        // A receipt number names one bill; the window is beside the point
        from: byReceipt ? undefined : fromIso,
        to: byReceipt ? undefined : toIso,
        receiptNumber: search.receipt,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    enabled: tab !== 'open' && (byReceipt || dayWindow !== null),
    placeholderData: keepPreviousData,
  })

  const openQuery = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: tab === 'open',
    refetchInterval: 30_000,
  })

  const historyColumns = useMemo(
    () => getHistoryColumns({ t, localized, locale, voided: tab === 'voided' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, tab]
  )
  const openColumns = useMemo(
    () => getOpenColumns({ t, localized, locale, nowMs }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, nowMs]
  )

  const historyRows = historyQuery.data?.items ?? []
  const historyTable = useTable({
    features: dataTableFeatures,
    data: historyRows,
    columns: historyColumns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
    rowCount: Number(historyQuery.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  // The floor is small enough to show whole; no paging
  const openRows = openQuery.data ?? []
  const openTable = useTable({
    features: dataTableFeatures,
    data: openRows,
    columns: openColumns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
  })

  const pageCount = historyTable.getPageCount()
  useEffect(() => {
    if (historyQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyQuery.data, pageCount])

  const switchTab = (value: string) => {
    if (!value) return
    navigate({
      search: (prev) => ({
        ...prev,
        page: undefined,
        receipt: undefined,
        status: value === 'settled' ? undefined : (value as TicketTab),
      }),
    })
  }

  const activeQuery = tab === 'open' ? openQuery : historyQuery

  return (
    <>
      <div className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            value={tab}
            onValueChange={switchTab}
          >
            {tabs.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                className='gap-1.5 px-3'
              >
                {t(item.key)}
                {item.value === 'open' && openQuery.data && (
                  <span className='text-muted-foreground tabular-nums'>
                    {openQuery.data.length}
                  </span>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {/* The receipt box lives in the page header; a match ignores the range */}
          {byReceipt && (
            <span className='text-muted-foreground text-xs'>
              {t('receiptIgnoresRange')}
            </span>
          )}
        </div>

        {activeQuery.isError ? (
          <ErrorState
            error={activeQuery.error}
            onRetry={() => activeQuery.refetch()}
          />
        ) : tab === 'open' ? (
          <DataTable
            table={openTable}
            isLoading={openQuery.isLoading}
            emptyMessage={t('noOpenTickets')}
            onRowClick={(row) => setSelectedTicketId(toNumber(row.original.id))}
          />
        ) : (
          <>
            <DataTable
              table={historyTable}
              isLoading={historyQuery.isLoading}
              emptyMessage={byReceipt ? t('noResults') : t('noTicketsInRange')}
              onRowClick={(row) =>
                setSelectedTicketId(toNumber(row.original.id))
              }
            />
            <DataTablePagination table={historyTable} />
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
