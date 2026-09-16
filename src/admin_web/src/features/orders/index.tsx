import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable, type SortingState } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'
import {
  getAllOrdersOptions,
  getPendingOrdersOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocale, useLocalized, useT } from '@/lib/i18n'
import { type RangeSearch } from '@/lib/search-schemas'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  DataTable,
  DataTableBulkActions,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { DateRangePicker } from '@/components/date-range-picker'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { useTillWindow } from '@/features/till/use-till-window'
import { getOrdersColumns } from './columns'
import { OrderDetailsSheet } from './components/order-details-sheet'
import { OrdersTabs } from './components/orders-tabs'
import { isCancelled, orderStatuses } from './status'
import { useOrderActions } from './use-order-actions'

const route = getRouteApi('/_authenticated/orders/history')

type SortParam = 'date_desc' | 'date_asc' | 'total_desc' | 'total_asc'

function toSortingState(sort: SortParam | undefined): SortingState {
  const [id, dir] = (sort ?? 'date_desc').split('_')
  return [{ id, desc: dir === 'desc' }]
}

function toSortParam(sorting: SortingState): SortParam | undefined {
  const first = sorting[0]
  if (!first) return undefined
  const param = `${first.id}_${first.desc ? 'desc' : 'asc'}` as SortParam
  return param === 'date_desc' ? undefined : param
}

/**
 * Every order the branch has taken, newest first: search by number or
 * customer, filter by status and business-day range, sort by time or
 * total. A row opens the ticket; confirming and cancelling happen there.
 */
export function OrdersManagement() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [orderToDelete, setOrderToDelete] = useState<number | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const {
    pagination,
    onPaginationChange,
    columnFilters,
    onColumnFiltersChange,
    globalFilter,
    onGlobalFilterChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPageSize: 20 },
    globalFilter: { key: 'q' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as
      | string[]
      | undefined) ?? []

  // History spans everything unless a business-day range is picked
  const { dayWindow, isAll, ready, fromIso, toIso } = useTillWindow(search, {
    defaultPreset: 'all',
  })

  const sorting = useMemo(() => toSortingState(search.sort), [search.sort])

  const ordersQuery = useQuery({
    ...getAllOrdersOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
        fromDate: isAll ? undefined : fromIso || undefined,
        toDate: isAll ? undefined : toIso || undefined,
        search: globalFilter || undefined,
        sort: search.sort,
      },
    }),
    enabled: ready,
    placeholderData: keepPreviousData,
  })

  const { data: pendingOrders = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR is the primary update path; this poll is only a fallback
    refetchInterval: 60_000,
  })

  const {
    confirm: handleConfirm,
    cancel: handleCancel,
    remove: handleDelete,
    removeMany: handleDeleteMany,
    isActing,
  } = useOrderActions()

  const columns = useMemo(
    () =>
      getOrdersColumns({
        onView: setSelectedOrderId,
        onDelete: setOrderToDelete,
        isActing,
        t,
        localized,
        locale,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isActing, language]
  )

  const orders = ordersQuery.data?.items ?? []

  const table = useTable({
    features: dataTableFeatures,
    data: orders,
    columns,
    getRowId: (row) => String(row.orderNumber),
    // Deletion is restricted to cancelled orders, so selection is too
    enableRowSelection: (row) => isCancelled(row.original.status),
    enableMultiSort: false,
    manualPagination: true,
    manualFiltering: true,
    manualSorting: true,
    rowCount: Number(ordersQuery.data?.totalCount ?? 0),
    state: { pagination, columnFilters, globalFilter, sorting },
    onPaginationChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      navigate({
        search: (prev) => ({
          ...prev,
          page: undefined,
          sort: toSortParam(next),
        }),
      })
    },
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (ordersQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersQuery.data, pageCount])

  const filtered =
    statusFilter.length > 0 || !!globalFilter || search.range != null

  return (
    <>
      <Main className='flex flex-col gap-4'>
        <PageHeader title={t('orders')}>
          <OrdersTabs value='history' pendingCount={pendingOrders.length} />
        </PageHeader>

        <DataTableToolbar
          table={table}
          searchPlaceholder={t('searchOrdersPlaceholder')}
          filters={[
            {
              columnId: 'status',
              title: t('status'),
              options: orderStatuses.map((s) => ({
                label: t(s.key),
                value: s.value,
                icon: s.icon,
              })),
            },
          ]}
        >
          <DateRangePicker
            search={search}
            dayWindow={dayWindow}
            defaultPreset='all'
            onChange={(next: RangeSearch) =>
              navigate({
                search: (prev) => ({ ...prev, page: undefined, ...next }),
              })
            }
          />
        </DataTableToolbar>

        {ordersQuery.isError ? (
          <ErrorState
            error={ordersQuery.error}
            onRetry={() => ordersQuery.refetch()}
          />
        ) : (
          <>
            <DataTable
              table={table}
              isLoading={ordersQuery.isLoading}
              emptyMessage={filtered ? t('noOrdersFound') : t('noOrdersYet')}
              onRowClick={(row) =>
                setSelectedOrderId(Number(row.original.orderNumber))
              }
            />
            <DataTablePagination table={table} />
          </>
        )}

        <DataTableBulkActions table={table} entityName={t('ordersEntity')}>
          <Button
            variant='destructive'
            size='sm'
            disabled={isActing}
            onClick={() => setBulkDeleteOpen(true)}
          >
            <Trash2 className='me-1 h-4 w-4' />
            {t('delete')}
          </Button>
        </DataTableBulkActions>
      </Main>

      <OrderDetailsSheet
        orderId={selectedOrderId}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null)
        }}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isActing={isActing}
      />

      <ConfirmDialog
        open={orderToDelete != null}
        onOpenChange={(open) => {
          if (!open) setOrderToDelete(null)
        }}
        title={t('deleteOrderQuestion')}
        desc={t('cannotBeUndone')}
        confirmText={t('delete')}
        destructive
        handleConfirm={() => {
          if (orderToDelete != null) handleDelete(orderToDelete)
          setOrderToDelete(null)
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={t('deleteOrdersQuestion')}
        desc={t('cannotBeUndone')}
        confirmText={t('delete')}
        destructive
        isLoading={isActing}
        handleConfirm={async () => {
          const selected = table
            .getSelectedRowModel()
            .rows.map((row) => Number(row.original.orderNumber))
          setBulkDeleteOpen(false)
          await handleDeleteMany(selected)
          table.resetRowSelection()
        }}
      />
    </>
  )
}
