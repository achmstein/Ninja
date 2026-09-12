import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { getStockCountsOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { CountSheet } from './components/count-sheet'
import { getCountColumns } from './count-columns'
import { HistoryPage } from './history-page'

const route = getRouteApi('/_authenticated/inventory/history/counts')

/** Stock counts posted at the active branch, newest first; a row opens the lines. */
export function StockCounts() {
  const t = useT()
  const locale = useLocale()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const query = useQuery({
    ...getStockCountsOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => getCountColumns({ t, locale }),
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

  return (
    <>
      <HistoryPage tab='counts'>
        <DataTable
          table={table}
          isLoading={query.isLoading}
          emptyMessage={t('noCounts')}
          onRowClick={(row) => setSelectedId(toNumber(row.original.id))}
        />

        <DataTablePagination table={table} />
      </HistoryPage>

      <CountSheet
        countId={selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </>
  )
}
