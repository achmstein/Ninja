import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { ArrowRight } from 'lucide-react'
import { getTransfersOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  DataTable,
  DataTablePagination,
  dataTableFeatures,
} from '@/components/data-table'
import { Dot, ListRow } from '@/components/list-row'
import { When } from '@/components/when'
import { TransferSheet } from './components/transfer-sheet'
import { HistoryPage } from './history-page'
import { getTransferColumns } from './transfer-columns'

const route = getRouteApi('/_authenticated/inventory/history/transfers')

/** Transfers in and out of the active branch, newest first; a row opens the lines. */
export function Transfers() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // The public branch list (cached by the sidebar switcher) names both ends;
  // a transfer may involve a branch this account is not assigned to
  const { data: branches = [] } = useQuery(getBranchesOptions())
  const branchName = (id: number | string) => {
    const branch = branches.find((b) => toNumber(b.id) === toNumber(id))
    return branch ? localized(branch.name) : t('unknownBranch')
  }

  const { pagination, onPaginationChange, ensurePageInRange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: false },
    })

  const query = useQuery({
    ...getTransfersOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
      },
    }),
    placeholderData: keepPreviousData,
  })

  const columns = useMemo(
    () => getTransferColumns({ t, locale, branchName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, branches]
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
      <HistoryPage tab='transfers'>
        <DataTable
          table={table}
          isLoading={query.isLoading}
          emptyMessage={t('noTransfers')}
          onRowClick={(row) => setSelectedId(toNumber(row.original.id))}
          mobileRow={({ original: x }) => (
            <ListRow
              title={
                <span className='flex items-center gap-1.5'>
                  {branchName(x.fromBranchId)}
                  <ArrowRight className='text-muted-foreground size-3.5 shrink-0 rtl:rotate-180' />
                  {branchName(x.toBranchId)}
                </span>
              }
              meta={
                <>
                  <When value={x.sentAt} mode='dateTime' />
                  <Dot />
                  <span>{x.sentBy}</span>
                </>
              }
              trailing={
                <span className='tabular-nums'>
                  {x.lines.length}{' '}
                  <span className='text-muted-foreground font-normal'>
                    {t('lines')}
                  </span>
                </span>
              }
            />
          )}
        />

        <DataTablePagination table={table} />
      </HistoryPage>

      <TransferSheet
        transferId={selectedId}
        branchName={branchName}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      />
    </>
  )
}
