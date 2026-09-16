import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Armchair, Plus, QrCode, Search } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { getPendingOrdersOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { type TableViewModel } from '@/api/spaces'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import {
  urgencyFor,
  urgencyTextClass,
  type Urgency,
} from '@/components/queue-card'
import {
  DELAYED_AFTER_MINUTES,
  relativeTime,
  WARN_AFTER_MINUTES,
} from '@/features/orders/status'
import { TableDialog } from './components/table-dialog'
import { TableSheet } from './components/table-sheet'

const route = getRouteApi('/_authenticated/tables/')

// Stable empty list so memoised derivations don't churn while loading
const NO_TABLES: TableViewModel[] = []

// Past this many tables the floor needs search and a status filter
const FILTER_THRESHOLD = 12

/**
 * The café floor as small tiles: each table's name and, when orders are
 * waiting on it, how many and how long. Tapping a tile opens the table —
 * its orders with Confirm in reach, then its settings.
 */
export function TablesManagement() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [addOpen, setAddOpen] = useState(false)

  // Tick every 30s so waiting times and colours advance between refetches
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const tablesQuery = useQuery(listTablesOptions())
  const tables = tablesQuery.data ?? NO_TABLES

  const { data: pendingOrders = [] } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR order events are the primary update path; this poll is a fallback
    refetchInterval: 60_000,
  })

  // Orders waiting per table, oldest first
  const ordersByTable = useMemo(() => {
    const map = new Map<number, OrderSummary[]>()
    for (const order of pendingOrders) {
      if (order.tableId == null) continue
      const list = map.get(Number(order.tableId)) ?? []
      list.push(order)
      map.set(Number(order.tableId), list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime()
      )
    }
    return map
  }, [pendingOrders])

  const showFilters =
    tables.length > FILTER_THRESHOLD || !!search.q || !!search.status
  const query = (search.q ?? '').trim().toLowerCase()
  const visible = tables.filter((table) => {
    if (search.status === 'active' && !table.isActive) return false
    if (search.status === 'inactive' && table.isActive) return false
    if (!query) return true
    const name = `${table.name?.en ?? ''} ${table.name?.ar ?? ''}`.toLowerCase()
    return name.includes(query)
  })

  // Prefill the next table's name so adding a row of them is just save, save, save
  const nextNumber = tables.length + 1
  const suggestedName = {
    en: `Table ${nextNumber}`,
    ar: `ترابيزة ${nextNumber}`,
  }

  const selected = tables.find((table) => Number(table.id) === search.table)
  const busyCount = [...ordersByTable.keys()].filter((id) =>
    tables.some((table) => Number(table.id) === id)
  ).length

  const setSearch = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) })

  return (
    <>
      <Main>
        <PageHeader
          title={t('tables')}
          badge={
            busyCount > 0 && (
              <Badge className='h-6 tabular-nums'>
                {t('tablesWithOpenOrders', { count: busyCount })}
              </Badge>
            )
          }
          actions={
            <>
              <Button size='sm' variant='outline' asChild>
                <Link to='/tables/print'>
                  <QrCode className='me-2 h-4 w-4' />
                  {t('printQrSheet')}
                </Link>
              </Button>
              <Button size='sm' onClick={() => setAddOpen(true)}>
                <Plus className='me-2 h-4 w-4' />
                {t('addTable')}
              </Button>
            </>
          }
        >
          {showFilters && (
            <div className='flex flex-wrap items-center gap-2'>
              <div className='relative'>
                <Search className='text-muted-foreground absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
                <Input
                  value={search.q ?? ''}
                  onChange={(e) =>
                    setSearch({ q: e.target.value || undefined })
                  }
                  placeholder={t('searchTables')}
                  className='h-8 w-56 ps-8'
                />
              </div>
              <ToggleGroup
                type='single'
                variant='outline'
                size='sm'
                value={search.status ?? 'all'}
                onValueChange={(value) =>
                  setSearch({
                    status:
                      value && value !== 'all'
                        ? (value as 'active' | 'inactive')
                        : undefined,
                  })
                }
              >
                <ToggleGroupItem value='all' className='px-3'>
                  {t('all')}
                </ToggleGroupItem>
                <ToggleGroupItem value='active' className='px-3'>
                  {t('active')}
                </ToggleGroupItem>
                <ToggleGroupItem value='inactive' className='px-3'>
                  {t('inactive')}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}
        </PageHeader>

        {tablesQuery.isError ? (
          <ErrorState
            error={tablesQuery.error}
            onRetry={() => tablesQuery.refetch()}
          />
        ) : tablesQuery.isLoading ? (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className='h-[92px] w-full rounded-lg' />
            ))}
          </div>
        ) : tables.length === 0 ? (
          <EmptyState
            icon={Armchair}
            title={t('noTablesYet')}
            action={
              <Button onClick={() => setAddOpen(true)} variant='outline'>
                <Plus className='me-2 h-4 w-4' />
                {t('addTable')}
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Armchair}
            title={t('noResults')}
            action={
              <Button
                variant='outline'
                onClick={() => setSearch({ q: undefined, status: undefined })}
              >
                {t('clearFilters')}
              </Button>
            }
          />
        ) : (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'>
            {visible.map((table) => {
              const orders = ordersByTable.get(Number(table.id)) ?? []
              const oldest = orders[0]?.date
              const urgency: Urgency = urgencyFor(
                oldest,
                nowMs,
                WARN_AFTER_MINUTES,
                DELAYED_AFTER_MINUTES
              )
              return (
                <button
                  key={String(table.id)}
                  type='button'
                  onClick={() => setSearch({ table: Number(table.id) })}
                  className={cn(
                    'bg-card hover:bg-accent/50 focus-visible:ring-ring/50 flex flex-col gap-2 rounded-lg border p-4 text-start transition-colors outline-none focus-visible:ring-[3px]',
                    orders.length > 0 &&
                      urgency === 'fresh' &&
                      'border-primary/40',
                    urgency === 'warning' && 'border-warning/70',
                    urgency === 'delayed' && 'border-destructive/70',
                    !table.isActive && 'border-dashed opacity-70'
                  )}
                >
                  <div className='flex items-start justify-between gap-2'>
                    <Armchair
                      className={cn(
                        'size-5 shrink-0',
                        orders.length > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      )}
                    />
                    {orders.length > 0 && (
                      <Badge className='h-5 min-w-5 rounded-full px-1.5 tabular-nums'>
                        {orders.length}
                      </Badge>
                    )}
                  </div>
                  <div className='truncate font-medium'>
                    {localized(table.name)}
                  </div>
                  <div
                    className={cn(
                      'truncate text-xs',
                      orders.length > 0
                        ? urgencyTextClass(urgency)
                        : 'text-muted-foreground'
                    )}
                  >
                    {orders.length > 0
                      ? relativeTime(oldest, nowMs, t, locale)
                      : table.isActive
                        ? t('available')
                        : t('tableInactive')}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Main>

      {addOpen && (
        <TableDialog
          table={null}
          open
          suggestedName={suggestedName}
          onOpenChange={setAddOpen}
        />
      )}

      <TableSheet
        table={selected ?? null}
        orders={selected ? (ordersByTable.get(Number(selected.id)) ?? []) : []}
        nowMs={nowMs}
        suggestedName={suggestedName}
        onOpenChange={(open) => {
          if (!open) setSearch({ table: undefined })
        }}
      />
    </>
  )
}
