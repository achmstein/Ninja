import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { ArrowLeft, Trash2 } from 'lucide-react'
import {
  getAllOrdersOptions,
  getPendingOrdersOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  DataTable,
  DataTableBulkActions,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import {
  useLanguage,
  useLocale,
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { getOrdersColumns } from './columns'
import { OrderDetailsSheet } from './components/order-details-sheet'
import { isCancelled, orderStatuses } from './status'
import { useOrderActions } from './use-order-actions'

const route = getRouteApi('/_authenticated/orders/history')

type DateRange = 'today' | '7d' | '30d'

const dateRanges: { value: DateRange; key: TranslationKey; days: number }[] = [
  { value: 'today', key: 'today', days: 0 },
  { value: '7d', key: 'last7Days', days: 7 },
  { value: '30d', key: 'last30Days', days: 30 },
]

// Midnight-based so the value is stable across renders (no query-key churn)
function rangeToFromDate(range: DateRange | undefined): string | undefined {
  if (!range) return undefined
  const days = dateRanges.find((r) => r.value === range)?.days ?? 0
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  from.setDate(from.getDate() - days)
  return from.toISOString()
}

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
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPageSize: 20 },
    globalFilter: { enabled: false },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })

  const statusFilter =
    (columnFilters.find((f) => f.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const fromDate = useMemo(() => rangeToFromDate(search.range), [search.range])

  const ordersQuery = useQuery({
    ...getAllOrdersOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        status: statusFilter.length > 0 ? statusFilter.join(',') : undefined,
        fromDate,
      },
    }),
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
        onConfirm: handleConfirm,
        onCancel: handleCancel,
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
    enableSorting: false,
    // Deletion is restricted to cancelled orders, so selection is too
    enableRowSelection: (row) => isCancelled(row.original.status),
    manualPagination: true,
    manualFiltering: true,
    rowCount: Number(ordersQuery.data?.totalCount ?? 0),
    state: { pagination, columnFilters },
    onPaginationChange,
    onColumnFiltersChange,
  })

  const pageCount = table.getPageCount()
  useEffect(() => {
    if (ordersQuery.data) ensurePageInRange(pageCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordersQuery.data, pageCount])

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex items-center gap-2'>
          <Button size='icon' variant='ghost' className='-ms-2' asChild>
            <Link to='/orders' aria-label={t('orders')}>
              <ArrowLeft size={20} className='rtl:rotate-180' />
            </Link>
          </Button>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('orderHistory')}
              </h1>
              {pendingOrders.length > 0 && (
                <Badge variant='default' className='h-6'>
                  {t('ordersPending', { count: pendingOrders.length })}
                </Badge>
              )}
            </div>
            <p className='text-muted-foreground'>{t('ordersSubtitle')}</p>
          </div>
        </div>

        <DataTableToolbar
          table={table}
          showSearch={false}
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
          <Select
            value={search.range ?? 'all'}
            onValueChange={(value) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  page: undefined,
                  range: value === 'all' ? undefined : (value as DateRange),
                }),
              })
            }
          >
            <SelectTrigger size='sm' className='h-8 w-[140px]'>
              <SelectValue placeholder={t('allTime')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('allTime')}</SelectItem>
              {dateRanges.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DataTableToolbar>

        <DataTable
          table={table}
          isLoading={ordersQuery.isLoading}
          emptyMessage={
            statusFilter.length > 0 || search.range
              ? t('noOrdersFound')
              : t('noOrdersYet')
          }
          onRowClick={(row) =>
            setSelectedOrderId(Number(row.original.orderNumber))
          }
        />

        <DataTablePagination table={table} />

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

      <AlertDialog
        open={orderToDelete != null}
        onOpenChange={(open) => {
          if (!open) setOrderToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteOrderQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteOrderConfirmation', { orderNumber: orderToDelete ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={() => {
                if (orderToDelete != null) handleDelete(orderToDelete)
                setOrderToDelete(null)
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteOrdersQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteOrdersConfirmation', {
                count: table.getSelectedRowModel().rows.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-white hover:bg-destructive/90'
              onClick={async () => {
                const selected = table
                  .getSelectedRowModel()
                  .rows.map((row) => Number(row.original.orderNumber))
                setBulkDeleteOpen(false)
                await handleDeleteMany(selected)
                table.resetRowSelection()
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
