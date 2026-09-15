import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useTable } from '@tanstack/react-table'
import { ChefHat, CircleAlert, Percent, TriangleAlert } from 'lucide-react'
import { listItemsOptions } from '@/api/catalog/@tanstack/react-query.gen'
import { getRecipeCostsOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  dataTableFeatures,
} from '@/components/data-table'
import { Main } from '@/components/layout/main'
import { getMenuCostColumns } from './menu-cost-columns'
import {
  DEFAULT_FOOD_COST_TARGET,
  summarize,
  toMenuCostRows,
} from './menu-cost-rows'

const route = getRouteApi('/_authenticated/inventory/menu-cost')

/**
 * Every tracked menu item with what one sale costs at the active branch's
 * average ingredient costs, against its price: the margin and the food-cost
 * share, the worst first. Inventory knows the costs, Catalog the prices;
 * this page joins them. The target lives in the URL so a link carries it.
 */
export function MenuCost() {
  const t = useT()
  const localized = useLocalized()
  const language = useLanguage((s) => s.language)
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const target = search.target ?? DEFAULT_FOOD_COST_TARGET

  const costs = useQuery(
    getRecipeCostsOptions({ query: { 'api-version': API_VERSION } })
  )
  const items = useQuery(
    listItemsOptions({ query: { 'api-version': API_VERSION } })
  )

  const rows = useMemo(
    () => toMenuCostRows(costs.data ?? [], items.data ?? [], target),
    [costs.data, items.data, target]
  )
  const summary = useMemo(() => summarize(rows, target), [rows, target])

  const { globalFilter, onGlobalFilterChange, pagination, onPaginationChange } =
    useTableUrlState({
      search,
      navigate,
      pagination: { defaultPageSize: 20 },
      globalFilter: { enabled: true, key: 'q' },
    })

  const columns = useMemo(
    () => getMenuCostColumns({ t, localized }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]
  )

  const table = useTable({
    features: dataTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => String(row.catalogItemId),
    enableSorting: false,
    globalFilterFn: 'includesString',
    state: { pagination, globalFilter: globalFilter ?? '' },
    onPaginationChange,
    onGlobalFilterChange,
  })

  const loading = costs.isPending || items.isPending

  return (
    <Main className='flex flex-col gap-4'>
      <div className='flex flex-wrap items-end justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>{t('menuCost')}</h1>
          <p className='text-muted-foreground'>{t('menuCostSubtitle')}</p>
        </div>
        <div className='flex items-center gap-2'>
          <Label htmlFor='food-cost-target' className='whitespace-nowrap'>
            {t('foodCostTarget')}
          </Label>
          <div className='relative'>
            <Input
              id='food-cost-target'
              type='number'
              min='1'
              max='99'
              inputMode='numeric'
              className='w-20 pe-6 text-end tabular-nums'
              value={target}
              onChange={(e) => {
                const next = Math.round(Number(e.target.value))
                navigate({
                  search: (prev) => ({
                    ...prev,
                    page: undefined,
                    target:
                      next > 0 &&
                      next < 100 &&
                      next !== DEFAULT_FOOD_COST_TARGET
                        ? next
                        : undefined,
                  }),
                })
              }}
            />
            <span className='text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-sm'>
              %
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-28' />
          ))}
        </div>
      ) : (
        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            label={t('trackedItems')}
            value={String(summary.tracked)}
            icon={ChefHat}
          />
          <StatCard
            label={t('averageFoodCost')}
            value={
              summary.averageFoodCost === null
                ? '—'
                : `${summary.averageFoodCost}%`
            }
            icon={Percent}
            className={
              summary.averageFoodCost !== null &&
              summary.averageFoodCost > target
                ? 'text-destructive'
                : ''
            }
          />
          <StatCard
            label={t('itemsOverTarget', { target })}
            value={String(summary.over)}
            icon={TriangleAlert}
            className={summary.over > 0 ? 'text-destructive' : ''}
          />
          <StatCard
            label={t('itemsWithUncostedIngredients')}
            value={String(summary.incomplete)}
            icon={CircleAlert}
            className={summary.incomplete > 0 ? 'text-warning' : ''}
          />
        </div>
      )}

      <DataTableToolbar
        table={table}
        searchPlaceholder={t('searchMenuCostPlaceholder')}
      />

      <DataTable
        table={table}
        isLoading={loading}
        emptyMessage={t('noTrackedItems')}
      />

      <DataTablePagination table={table} />
    </Main>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  className?: string
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <Icon className='text-muted-foreground h-4 w-4' />
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tabular-nums', className)}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
