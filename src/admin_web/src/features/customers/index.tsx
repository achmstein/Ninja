import { useEffect, useMemo, useRef, useState } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ArrowUpDown, Search, UserRound, Users } from 'lucide-react'
import { getGuests } from '@/api/ordering'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useLocale, useT, type TranslationKey } from '@/lib/i18n'
import { showPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/empty-state'
import { EntityAvatar } from '@/components/entity-avatar'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { OldBalancesButton } from '@/features/accounts/components/old-balances-dialog'
import { accountsService } from '@/features/accounts/services/accounts-service'
import { useLoyaltyAccounts } from '@/features/loyalty/hooks/use-loyalty'
import { tierColors, type LoyaltyTier } from '@/features/loyalty/types'
import { formatEgp, relativeTime } from '@/features/orders/status'
import {
  AddCustomerButton,
  AddedAtCounterBadge,
} from './components/counter-customer'
import { CustomerPanel } from './components/customer-panel'
import { CustomerStats } from './components/customer-stats'
import { GuestPanel } from './components/guest-panel'
import { allowedFilter, type CustomerFilter } from './filter'
import { customersKeys, useCustomerCount } from './hooks/use-customers'
import { customersService } from './services/customers-service'
import { sortRows, type CustomerRow, type CustomerSort } from './sort'
import { getCustomerDisplayName } from './types'

const route = getRouteApi('/_authenticated/customers/')

// Staff accounts live on the Staff page
const STAFF_ROLES = 'Admin,Owner,Cashier'
// The whole directory in one read: it is sorted here, by what other services know
const EVERYONE = 20000
// A search's answers, ranked by the server
const MOST_FOUND = 200
const GUESTS_PAGE = 40
// Rows drawn at first, and added each time the end scrolls into view
const DRAWN_AT_A_TIME = 60

const sortLabels: Record<CustomerSort, TranslationKey> = {
  lastOrder: 'lastOrder',
  spent: 'customerSpent',
  owes: 'owes',
  points: 'customerPoints',
  name: 'name',
}

/**
 * Customers as one list across the page, then one customer as a page of
 * their own. Each row says what an owner scans for: when they last ordered,
 * how often and how much, what they owe and the points they hold; the list
 * sorts by any of them. The views narrow it to those who owe, the loyalty
 * members, the guests (people who ordered without an account, gathered by
 * Ordering from their orders) and the accounts switched off. A search is
 * the server's own, the till's: either script, any spelling.
 */
export function Customers() {
  const t = useT()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const query = (search.q ?? '').trim()
  const features = useFeatures()
  // A view whose module is off (a /loyalty or /accounts link from before) is the whole list
  const filter = allowedFilter(search.filter, features)
  const guestsView = filter === 'guests'
  const offView = filter === 'off'

  const select = (customer: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, customer }) })
  const selectGuest = (guest: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, guest }) })
  const setFilter = (next: CustomerFilter | undefined) =>
    navigate({ search: (prev) => ({ ...prev, filter: next }) })
  const setSort = (next: CustomerSort) =>
    navigate({ search: (prev) => ({ ...prev, sort: next }) })

  // What the other services know of each customer, read whole and joined to the rows
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAccounts(),
    enabled: features.tabs,
  })
  const members = useLoyaltyAccounts(0, 1000)
  const orders = useQuery({
    queryKey: [...customersKeys.all, 'order-summaries'],
    queryFn: () => customersService.getOrderSummaries(),
  })

  // Everyone, or those a search found (in the server's order: closest first)
  const directory = useQuery({
    queryKey: [...customersKeys.lists(), 'everyone', offView, query],
    queryFn: () =>
      customersService.getCustomers({
        max: query ? MOST_FOUND : EVERYONE,
        search: query || undefined,
        excludeRole: STAFF_ROLES,
        enabled: !offView,
      }),
    enabled: !guestsView,
    placeholderData: keepPreviousData,
  })
  const offCount = useCustomerCount({
    excludeRole: STAFF_ROLES,
    enabled: false,
  })

  // Guests, a page at a time; Ordering folds their orders into one row
  // per phone number, most recent first
  const guests = useInfiniteQuery({
    queryKey: [{ _id: 'getGuests' }, 'infinite', query],
    queryFn: async ({ pageParam }) => {
      const { data } = await getGuests({
        query: {
          'api-version': API_VERSION,
          pageIndex: pageParam,
          pageSize: GUESTS_PAGE,
          search: query || undefined,
        },
        throwOnError: true,
      })
      return data
    },
    initialPageParam: 0,
    getNextPageParam: (last) =>
      last.hasNextPage ? Number(last.pageIndex ?? 0) + 1 : undefined,
    enabled: guestsView,
  })
  const guestRows = useMemo(
    () => guests.data?.pages.flatMap((page) => page.items ?? []) ?? [],
    [guests.data]
  )

  const everyone = useMemo<CustomerRow[]>(() => {
    const balances = new Map(
      (accounts.data ?? []).map((a) => [a.customerId, a.balance])
    )
    const points = new Map((members.data ?? []).map((m) => [m.userId, m]))
    const ordered = new Map((orders.data ?? []).map((o) => [o.customerId, o]))
    const rows: CustomerRow[] = (directory.data ?? []).map((c) => {
      const member = points.get(c.id)
      const summary = ordered.get(c.id)
      return {
        id: c.id,
        name: getCustomerDisplayName(c),
        contact: showPhone(c.phoneNumber) || c.email || undefined,
        addedAtCounter: c.addedAtCounter,
        lastOrderAt: summary?.lastOrderAt,
        orderCount: summary?.orderCount ?? 0,
        spent: summary?.totalSpent ?? 0,
        balance: balances.get(c.id) ?? 0,
        member: !!member,
        points: member?.pointsBalance ?? 0,
        tier: member?.currentTier,
      }
    })
    // Someone who owes but is not in the list read (their account was
    // switched off, or merged away): the debt is still the business's to see
    if (!offView && directory.data) {
      const listed = new Set(rows.map((r) => r.id))
      const q = query.toLowerCase()
      for (const a of accounts.data ?? []) {
        if (a.balance <= 0 || listed.has(a.customerId)) continue
        const name = a.customerName || t('unknownCustomer')
        if (q && !name.toLowerCase().includes(q)) continue
        const summary = ordered.get(a.customerId)
        rows.push({
          id: a.customerId,
          name,
          lastOrderAt: summary?.lastOrderAt,
          orderCount: summary?.orderCount ?? 0,
          spent: summary?.totalSpent ?? 0,
          balance: a.balance,
          member: points.has(a.customerId),
          points: points.get(a.customerId)?.pointsBalance ?? 0,
          tier: points.get(a.customerId)?.currentTier,
          owingOnly: true,
        })
      }
    }
    return rows
  }, [
    directory.data,
    accounts.data,
    members.data,
    orders.data,
    offView,
    query,
    t,
  ])

  const owing = useMemo(() => everyone.filter((r) => r.balance > 0), [everyone])
  const inProgram = useMemo(() => everyone.filter((r) => r.member), [everyone])
  const inDirectory = useMemo(
    () => everyone.filter((r) => !r.owingOnly),
    [everyone]
  )

  // What the list is sorted by: the owner's pick, or what the view is about.
  // A search keeps the server's order (closest name first) until a sort is picked
  const viewSort: CustomerSort =
    filter === 'owing' ? 'owes' : filter === 'members' ? 'points' : 'lastOrder'
  const sort = search.sort ?? viewSort
  const rows = useMemo(() => {
    const shown =
      filter === 'owing'
        ? owing
        : filter === 'members'
          ? inProgram
          : inDirectory
    return query && !search.sort ? shown : sortRows(shown, sort)
  }, [filter, owing, inProgram, inDirectory, query, search.sort, sort])

  const allFilters: {
    value: CustomerFilter | undefined
    label: string
    count?: number
  }[] = [
    {
      value: undefined,
      label: t('all'),
      count: offView || guestsView ? undefined : inDirectory.length,
    },
    {
      value: 'owing',
      label: t('owing'),
      count: offView || guestsView ? undefined : owing.length,
    },
    {
      value: 'members',
      label: t('members'),
      count: offView || guestsView ? undefined : inProgram.length,
    },
    {
      value: 'guests',
      label: t('guests'),
      count:
        guests.data?.pages[0]?.totalCount != null
          ? Number(guests.data.pages[0].totalCount)
          : undefined,
    },
    { value: 'off', label: t('disabled'), count: offCount.data },
  ]
  // The owing and members views follow the tabs and loyalty switches; the
  // switched-off accounts show once there are any (or while looked at)
  const filters = allFilters.filter(
    (f) =>
      (f.value !== 'owing' || features.tabs) &&
      (f.value !== 'members' || features.loyalty) &&
      (f.value !== 'off' || offView || (offCount.data ?? 0) > 0)
  )

  // One customer, or one guest, is the whole page
  if (!guestsView && search.customer) {
    return (
      <Main fixed>
        <CustomerPanel
          key={search.customer}
          customerId={search.customer}
          onBack={() => select(undefined)}
          onOpenCustomer={select}
        />
      </Main>
    )
  }
  if (guestsView && search.guest) {
    return (
      <Main fixed>
        <div className='bg-card flex min-h-0 flex-1 flex-col rounded-lg border'>
          <GuestPanel
            key={search.guest}
            guestKey={search.guest}
            guest={guestRows.find((g) => g.key === search.guest)}
            onBack={() => selectGuest(undefined)}
          />
        </div>
      </Main>
    )
  }

  const columns: Column[] = guestsView
    ? ['lastOrder', 'orders', 'spent']
    : [
        'lastOrder',
        'orders',
        'spent',
        ...(features.tabs ? (['owes'] as const) : []),
        ...(features.loyalty ? (['points'] as const) : []),
      ]
  const sorts = (
    ['lastOrder', 'spent', 'owes', 'points', 'name'] as CustomerSort[]
  ).filter(
    (s) =>
      (s !== 'owes' || features.tabs) && (s !== 'points' || features.loyalty)
  )
  const listQuery = guestsView ? guests : directory

  return (
    <Main fixed>
      <PageHeader
        title={t('customers')}
        actions={
          <>
            {features.tabs && <OldBalancesButton />}
            <AddCustomerButton onOpenCustomer={select} />
          </>
        }
      >
        <CustomerStats />
      </PageHeader>

      <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
        <div className='relative w-full sm:w-72'>
          <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
          <Input
            value={search.q ?? ''}
            onChange={(e) =>
              navigate({
                search: (prev) => ({ ...prev, q: e.target.value || undefined }),
                replace: true,
              })
            }
            placeholder={t('searchCustomersPlaceholder')}
            className='h-9 ps-8'
          />
        </div>
        <div className='flex flex-1 flex-wrap gap-1'>
          {filters.map((f) => (
            <Button
              key={f.label}
              variant={filter === f.value ? 'secondary' : 'ghost'}
              size='sm'
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              {f.count != null && (
                <span className='text-muted-foreground ms-1.5 tabular-nums'>
                  {f.count}
                </span>
              )}
            </Button>
          ))}
        </div>
        {!guestsView && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='outline' size='sm'>
                <ArrowUpDown />
                {t(sortLabels[sort])}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => setSort(value as CustomerSort)}
              >
                {sorts.map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {t(sortLabels[s])}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <section
        className='bg-card flex min-h-0 flex-1 flex-col rounded-lg border'
        style={
          {
            '--cols': `minmax(0,1fr) ${columns.map((c) => columnWidths[c]).join(' ')}`,
          } as React.CSSProperties
        }
      >
        {/* The column names, where there is room for columns */}
        <div className='text-muted-foreground hidden flex-none grid-cols-[var(--cols)] items-center gap-4 border-b px-4 py-2.5 text-xs font-medium md:grid'>
          <span>{t('name')}</span>
          {columns.map((c) => (
            <span key={c} className='text-end'>
              {t(columnLabels[c])}
            </span>
          ))}
        </div>
        {listQuery.isError ? (
          <ErrorState
            error={listQuery.error}
            onRetry={() => listQuery.refetch()}
          />
        ) : listQuery.isLoading ? (
          <div className='space-y-2 p-3'>
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className='h-12 rounded-md' />
            ))}
          </div>
        ) : guestsView ? (
          guestRows.length === 0 ? (
            <EmptyState
              compact
              icon={UserRound}
              title={t('noGuestsFound')}
              description={query ? undefined : t('noGuestsHint')}
            />
          ) : (
            <ScrollArea className='min-h-0 flex-1'>
              {guestRows.map((g) => (
                <ListRow
                  key={g.key ?? ''}
                  columns={columns}
                  row={{
                    id: g.key ?? '',
                    name: g.name || t('guestBadge'),
                    contact: g.phone ? showPhone(g.phone) : undefined,
                    lastOrderAt: g.lastOrderAt,
                    orderCount: Number(g.orderCount ?? 0),
                    spent: Number(g.totalSpent ?? 0),
                    balance: 0,
                    member: false,
                    points: 0,
                    guest: true,
                  }}
                  onOpen={selectGuest}
                />
              ))}
              <More
                more={guests.hasNextPage}
                loading={guests.isFetchingNextPage}
                onMore={() => guests.fetchNextPage()}
              />
            </ScrollArea>
          )
        ) : rows.length === 0 ? (
          <EmptyState compact icon={Users} title={t('noCustomersFound')} />
        ) : (
          // Starts again from the top when what is listed changes
          <DrawnRows
            key={`${filter ?? 'all'}|${query}|${sort}`}
            rows={rows}
            columns={columns}
            onOpen={select}
          />
        )}
      </section>
    </Main>
  )
}

type Column = 'lastOrder' | 'orders' | 'spent' | 'owes' | 'points'

const columnWidths: Record<Column, string> = {
  lastOrder: '8rem',
  orders: '5rem',
  spent: '7rem',
  owes: '7rem',
  points: '6rem',
}

const columnLabels: Record<Column, TranslationKey> = {
  lastOrder: 'lastOrder',
  orders: 'orders',
  spent: 'customerSpent',
  owes: 'owes',
  points: 'customerPoints',
}

/** A long list drawn a screenful at a time: the rows are all here, the page stays light */
function DrawnRows({
  rows,
  columns,
  onOpen,
}: {
  rows: CustomerRow[]
  columns: Column[]
  onOpen: (id: string) => void
}) {
  const [drawn, setDrawn] = useState(DRAWN_AT_A_TIME)
  return (
    <ScrollArea className='min-h-0 flex-1'>
      {rows.slice(0, drawn).map((row) => (
        <ListRow key={row.id} row={row} columns={columns} onOpen={onOpen} />
      ))}
      <More
        more={drawn < rows.length}
        loading={false}
        onMore={() => setDrawn((n) => n + DRAWN_AT_A_TIME)}
      />
    </ScrollArea>
  )
}

/** The end of the list: asks for more when it scrolls into view */
function More({
  more,
  loading,
  onMore,
}: {
  more: boolean
  loading: boolean
  onMore: () => void
}) {
  const sentinel = useRef<HTMLDivElement>(null)
  const ask = useRef(onMore)
  useEffect(() => {
    ask.current = onMore
  })
  useEffect(() => {
    const node = sentinel.current
    if (!node || !more || loading) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) ask.current()
      },
      { rootMargin: '300px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [more, loading])
  if (!more) return null
  return (
    <div ref={sentinel} className='flex h-10 items-center justify-center'>
      {loading && <Spinner />}
    </div>
  )
}

/**
 * One customer. Across a wide page, a line of columns under their names; on
 * a phone, the name over when they last ordered, with what they owe and
 * their points at the end.
 */
function ListRow({
  row,
  columns,
  onOpen,
}: {
  row: CustomerRow
  columns: Column[]
  onOpen: (id: string) => void
}) {
  const t = useT()
  const locale = useLocale()
  const [nowMs] = useState(() => Date.now())
  const last = row.lastOrderAt
    ? relativeTime(row.lastOrderAt, nowMs, t, locale)
    : undefined
  const owes =
    row.balance > 0 ? (
      <span className='text-destructive font-medium tabular-nums'>
        {formatEgp(row.balance)}
      </span>
    ) : null
  const points = row.member ? (
    <span
      className='font-medium tabular-nums'
      style={{ color: tierColors[row.tier as LoyaltyTier] }}
    >
      {row.points.toLocaleString(locale)}
    </span>
  ) : null
  const nothing = <span className='text-muted-foreground/60'>–</span>

  const cells: Record<Column, React.ReactNode> = {
    lastOrder: last ?? nothing,
    orders:
      row.orderCount > 0 ? row.orderCount.toLocaleString(locale) : nothing,
    spent: row.orderCount > 0 ? formatEgp(row.spent) : nothing,
    owes: owes ?? nothing,
    points: points ?? nothing,
  }

  return (
    <button
      type='button'
      className='hover:bg-accent/60 flex w-full items-center gap-3 border-b px-4 py-2.5 text-start text-sm last:border-b-0 md:grid md:grid-cols-[var(--cols)] md:gap-4'
      onClick={() => onOpen(row.id)}
    >
      <div className='flex min-w-0 flex-1 items-center gap-3'>
        <EntityAvatar name={row.name} className='size-8' />
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='truncate font-medium'>{row.name}</span>
            {row.guest && <Badge variant='outline'>{t('guestBadge')}</Badge>}
            {row.addedAtCounter && <AddedAtCounterBadge />}
          </div>
          <div className='text-muted-foreground truncate text-xs'>
            {/* On a phone the line under the name carries the last order too */}
            <span className='md:hidden'>
              {last ?? t('noOrdersYet')}
              {row.contact && ' · '}
            </span>
            {row.contact && <span dir='ltr'>{row.contact}</span>}
          </div>
        </div>
      </div>
      {/* Phone: what they owe over their points, at the end of the row */}
      {(owes || points || (row.guest && row.orderCount > 0)) && (
        <div className='flex shrink-0 flex-col items-end text-xs md:hidden'>
          {owes}
          {points && (
            <span>
              {points}{' '}
              <span className='text-muted-foreground'>{t('points')}</span>
            </span>
          )}
          {row.guest && row.orderCount > 0 && (
            <span className='font-medium tabular-nums'>
              {formatEgp(row.spent)}
            </span>
          )}
        </div>
      )}
      {columns.map((c) => (
        <span
          key={c}
          className={cn(
            'hidden truncate text-end tabular-nums md:block',
            c === 'lastOrder' && 'text-muted-foreground'
          )}
        >
          {cells[c]}
        </span>
      ))}
    </button>
  )
}
