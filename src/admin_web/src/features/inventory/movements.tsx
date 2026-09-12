import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { X } from 'lucide-react'
import { getStockMovementsOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { type RangeKey } from '@/lib/search-schemas'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/combobox'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { useTillWindow } from '@/features/till/use-till-window'
import { movementTypeKeys, MOVEMENT_TYPE_VALUES } from './format'
import { HistoryPage } from './history-page'
import { getMovementColumns } from './movement-columns'
import { stockItemsQueryOptions, toStockItemOptions } from './queries'

const route = getRouteApi('/_authenticated/inventory/history/')

// Calendar days in the URL, sent as the local day's bounds
/** The branch's stock ledger, filterable by item and date; the stock table links here per item. */
export function Movements() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  // Everything by default; a preset or custom days narrow it to business days
  const { dayWindow, isAll, ready, fromIso, toIso } = useTillWindow(search, {
    defaultPreset: 'all',
  })

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  // Retired items keep their history, so the picker lists them too
  const { data: items = [] } = useQuery(stockItemsQueryOptions(true))

  const query = useQuery({
    ...getStockMovementsOptions({
      query: {
        'api-version': API_VERSION,
        stockItemId: search.stockItemId,
        type: search.type,
        from: isAll ? undefined : fromIso,
        to: isAll ? undefined : toIso,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    placeholderData: keepPreviousData,
    enabled: ready,
  })

  const day = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const columns = useMemo(
    () => getMovementColumns({ t, localized, locale }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: query.data?.items ?? [],
    columns,
    getRowId: (row) => String(row.id),
    enableSorting: false,
    manualPagination: true,
    rowCount: Number(query.data?.totalCount ?? 0),
    state: { pagination },
    onPaginationChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (query.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, pageCount])

  const patchSearch = (next: {
    stockItemId?: number
    type?: number
    range?: RangeKey
    from?: string
    to?: string
  }) =>
    navigate({
      search: (prev) => ({ ...prev, page: undefined, ...next }),
    })

  const isFiltered = search.stockItemId != null || search.type != null || !isAll

  return (
    <>
      <HistoryPage tab='movements'>
        <div className='flex flex-wrap items-center gap-2'>
          <Combobox
            value={
              search.stockItemId != null ? String(search.stockItemId) : null
            }
            onChange={(value) =>
              patchSearch({ stockItemId: value ? Number(value) : undefined })
            }
            options={toStockItemOptions(items, localized, t)}
            placeholder={t('allItems')}
            clearLabel={t('allItems')}
            size='default'
            className='w-[240px]'
          />
          <Combobox
            value={search.type != null ? String(search.type) : null}
            onChange={(value) =>
              patchSearch({ type: value ? Number(value) : undefined })
            }
            options={MOVEMENT_TYPE_VALUES.map(({ value, name }) => ({
              value: String(value),
              label: t(movementTypeKeys[name]),
            }))}
            placeholder={t('allTypes')}
            clearLabel={t('allTypes')}
            size='default'
            className='w-[180px]'
          />
          <DateRangePicker
            search={search}
            dayWindow={dayWindow}
            defaultPreset='all'
            onChange={patchSearch}
          />
          {isFiltered && (
            <Button
              variant='ghost'
              size='sm'
              className='h-8 px-2 lg:px-3'
              onClick={() =>
                patchSearch({
                  stockItemId: undefined,
                  type: undefined,
                  range: undefined,
                  from: undefined,
                  to: undefined,
                })
              }
            >
              {t('clearFilters')}
              <X className='ms-2 h-4 w-4' />
            </Button>
          )}
        </div>

        <DataTable
          table={table}
          groupBy={{
            key: (row) => row.recordedAt.slice(0, 10),
            label: (_, first) => day.format(new Date(first.recordedAt)),
          }}
          isLoading={query.isLoading}
          emptyMessage={t('noStockMovements')}
        />

        <DataTablePagination table={table} />
      </HistoryPage>
    </>
  )
}
