import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { Ban, CircleCheck, Package, Plus, Tag } from 'lucide-react'
import { toast } from '@/lib/toast'
import { type CatalogItemDto } from '@/api/catalog'
import {
  deleteItemMutation,
  listCategoriesOptions,
  listItemsOptions,
  listItemsQueryKey,
  toggleItemAvailabilityMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
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
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { getMenuColumns } from './columns'
import { CustomizationsSheet } from './components/customizations-sheet'
import { DeleteConfirmDialog } from './components/delete-confirm-dialog'
import { MenuItemDialog } from './components/menu-item-dialog'

const route = getRouteApi('/_authenticated/menu/')

const listItemsQueryOptions = () =>
  listItemsOptions({ query: { 'api-version': API_VERSION } })

export function MenuManagement() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItemDto | null>(null)
  const [deleteItem, setDeleteItem] = useState<CatalogItemDto | null>(null)
  const [customizeItem, setCustomizeItem] = useState<CatalogItemDto | null>(
    null
  )

  const { data: items = [], isLoading } = useQuery(listItemsQueryOptions())
  const { data: categories = [] } = useQuery(
    listCategoriesOptions({ query: { 'api-version': API_VERSION } })
  )

  const {
    globalFilter,
    onGlobalFilterChange,
    pagination,
    onPaginationChange,
    columnFilters,
    onColumnFiltersChange,
  } = useTableUrlState({
    search,
    navigate,
    pagination: { defaultPageSize: 20 },
    globalFilter: { enabled: true, key: 'q' },
    columnFilters: [
      { columnId: 'category', searchKey: 'category', type: 'array' },
      { columnId: 'availability', searchKey: 'availability', type: 'array' },
    ],
  })

  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listItems' }] })

  // Availability flips optimistically: update the cached list first, roll
  // back if the server rejects it.
  const toggleAvailability = useMutation({
    ...toggleItemAvailabilityMutation(),
    onMutate: async (variables) => {
      const queryKey = listItemsQueryKey({
        query: { 'api-version': API_VERSION },
      })
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<CatalogItemDto[]>(queryKey)
      queryClient.setQueryData<CatalogItemDto[]>(queryKey, (old) =>
        old?.map((item) =>
          Number(item.id) === variables.path.id
            ? { ...item, isAvailable: variables.body?.isAvailable ?? false }
            : item
        )
      )
      return { previous, queryKey }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
      toast.error(t('failedToUpdateAvailability'))
    },
    onSettled: () => invalidateItems(),
  })

  const deleteMutation = useMutation({
    ...deleteItemMutation(),
    onSuccess: () => {
      invalidateItems()
      toast.success(t('itemDeleted'))
      setDeleteItem(null)
    },
    onError: () => toast.error(t('failedToDeleteItem')),
  })

  const handleToggle = (item: CatalogItemDto, isAvailable: boolean) =>
    toggleAvailability.mutate({
      path: { id: Number(item.id) },
      body: { isAvailable },
      query: { 'api-version': API_VERSION },
    })

  const columns = useMemo(
    () =>
      getMenuColumns({
        onEdit: (item) => {
          setEditingItem(item)
          setDialogOpen(true)
        },
        onDelete: setDeleteItem,
        onCustomize: setCustomizeItem,
        onToggleAvailability: handleToggle,
        t,
        localized,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: items,
    columns,
    getRowId: (row) => String(row.id),
    enableRowSelection: true,
    globalFilterFn: 'includesString',
    state: { pagination, columnFilters, globalFilter: globalFilter ?? '' },
    onPaginationChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
  })

  const bulkSetAvailability = async (isAvailable: boolean) => {
    const selected = table.getSelectedRowModel().rows.map((r) => r.original)
    await Promise.all(
      selected.map((item) =>
        toggleAvailability.mutateAsync({
          path: { id: Number(item.id) },
          body: { isAvailable },
          query: { 'api-version': API_VERSION },
        })
      )
    )
    table.resetRowSelection()
    toast.success(
      t(isAvailable ? 'markedAvailable' : 'markedUnavailable', {
        count: selected.length,
      })
    )
  }

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>{t('menu')}</h1>
            <p className='text-muted-foreground'>{t('menuSubtitle')}</p>
          </div>
          <div className='flex items-center gap-2'>
            <Button variant='outline' asChild>
              <Link to='/menu/bundles'>
                <Package className='me-2 h-4 w-4' />
                {t('bundleDeals')}
              </Link>
            </Button>
            <Button variant='outline' asChild>
              <Link to='/menu/categories'>
                <Tag className='me-2 h-4 w-4' />
                {t('categories')}
              </Link>
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null)
                setDialogOpen(true)
              }}
            >
              <Plus className='me-2 h-4 w-4' />
              {t('addItem')}
            </Button>
          </div>
        </div>

        <DataTableToolbar
          table={table}
          searchPlaceholder={t('searchItemsPlaceholder')}
          filters={[
            {
              columnId: 'category',
              title: t('category'),
              options: categories.map((c) => ({
                label: localized(c.name) || String(c.id),
                value: String(c.id),
              })),
            },
            {
              columnId: 'availability',
              title: t('availability'),
              options: [
                { label: t('availableLabel'), value: 'available' },
                { label: t('unavailable'), value: 'unavailable' },
              ],
            },
          ]}
        />

        <DataTable
          table={table}
          isLoading={isLoading}
          emptyMessage={t('noItemsFound')}
          onRowClick={(row) => {
            setEditingItem(row.original)
            setDialogOpen(true)
          }}
        />

        <DataTablePagination table={table} />

        <DataTableBulkActions table={table} entityName={t('item')}>
          <Button
            variant='outline'
            size='sm'
            onClick={() => bulkSetAvailability(true)}
          >
            <CircleCheck className='me-1 h-4 w-4' />
            {t('availableLabel')}
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => bulkSetAvailability(false)}
          >
            <Ban className='me-1 h-4 w-4' />
            {t('unavailable')}
          </Button>
        </DataTableBulkActions>
      </Main>

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingItem(null)
        }}
        item={editingItem}
        categories={categories}
        onManageCustomizations={() => {
          setCustomizeItem(editingItem)
          setDialogOpen(false)
          setEditingItem(null)
        }}
      />

      <CustomizationsSheet
        item={customizeItem}
        onOpenChange={(open) => {
          if (!open) setCustomizeItem(null)
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onOpenChange={() => setDeleteItem(null)}
        onConfirm={() =>
          deleteItem &&
          deleteMutation.mutate({
            path: { id: Number(deleteItem.id) },
            query: { 'api-version': API_VERSION },
          })
        }
        itemName={localized(deleteItem?.name)}
        isLoading={deleteMutation.isPending}
      />
    </>
  )
}
