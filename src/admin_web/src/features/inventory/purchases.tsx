import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { getPurchasesOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { PurchaseSheet } from './components/purchase-sheet'
import { HistoryPage } from './history-page'
import { getPurchaseColumns } from './purchase-columns'

const route = getRouteApi('/_authenticated/inventory/history/purchases')

/** Deliveries received at the active branch, newest first; a row opens the lines. */
export function Purchases() {
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
    ...getPurchasesOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => getPurchaseColumns({ t, locale }),
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
      <HistoryPage tab='purchases'>
        <DataTable
          table={table}
          isLoading={query.isLoading}
          emptyMessage={t('noPurchases')}
          onRowClick={(row) => setSelectedId(toNumber(row.original.id))}
        />

        <DataTablePagination table={table} />
      </HistoryPage>

      <PurchaseSheet
        purchaseId={selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </>
  )
}
