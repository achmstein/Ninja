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
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { RangeToolbar } from './components/range-toolbar'
import {
  TICKET_STATUS_SETTLED,
  TICKET_STATUS_VOIDED,
} from './components/tender'
import { TicketSheet } from './components/ticket-sheet'
import { getHistoryColumns, getOpenColumns } from './ticket-columns'
import { useTillWindow } from './use-till-window'

const route = getRouteApi('/_authenticated/till/tickets')

type TicketTab = 'settled' | 'open' | 'voided'

const tabs: { value: TicketTab; key: TranslationKey }[] = [
  { value: 'settled', key: 'statusSettled' },
  { value: 'open', key: 'statusOpen' },
  { value: 'voided', key: 'statusVoided' },
]

/**
 * Every bill the branch wrote: settled and voided ones over a window of
 * business days (or one bill by receipt number), and the ones still open on
 * the floor. Read-only — a row opens the ticket, nothing more.
 */
export function TillTickets() {
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
    () => getOpenColumns({ t, localized, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
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

  const switchTab = (value: string) =>
    navigate({
      search: (prev) => ({
        ...prev,
        page: undefined,
        receipt: undefined,
        status: value === 'settled' ? undefined : (value as TicketTab),
      }),
    })

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t('tillTickets')}
          </h1>
          <p className='text-muted-foreground'>{t('tillTicketsSubtitle')}</p>
        </div>

        <Tabs value={tab} onValueChange={switchTab}>
          <TabsList>
            {tabs.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {t(item.key)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {tab !== 'open' && (
          <RangeToolbar
            search={search}
            dayWindow={dayWindow}
            onChange={(next) =>
              navigate({
                search: (prev) => ({ ...prev, page: undefined, ...next }),
              })
            }
          >
            {/* Only settled tickets have receipts to look up */}
            {tab === 'settled' && (
              <Input
                type='number'
                inputMode='numeric'
                min={1}
                placeholder={t('receiptSearchPlaceholder')}
                value={search.receipt ?? ''}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      page: undefined,
                      receipt: value > 0 ? value : undefined,
                    }),
                  })
                }}
                className='h-8 w-[150px]'
              />
            )}
          </RangeToolbar>
        )}

        {tab === 'open' ? (
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
