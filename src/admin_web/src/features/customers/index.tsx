import { useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { Search, UserRound, Users } from 'lucide-react'
import { getGuests } from '@/api/ordering'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { accountsService } from '@/features/accounts/services/accounts-service'
import { tierNameKeys } from '@/features/loyalty/components/tier-name'
import { useLoyaltyAccounts } from '@/features/loyalty/hooks/use-loyalty'
import { tierColors } from '@/features/loyalty/types'
import { formatEgp, relativeTime } from '@/features/orders/status'
import { CustomerPanel } from './components/customer-panel'
import { CustomerStats } from './components/customer-stats'
import { GuestPanel } from './components/guest-panel'
import { customersKeys, useCustomerCount } from './hooks/use-customers'
import { customersService } from './services/customers-service'
import { getCustomerDisplayName } from './types'
import { useFeatures } from '@/lib/brand'
import { allowedFilter, type CustomerFilter } from './filter'

const route = getRouteApi('/_authenticated/customers/')

const PAGE_SIZE = 40
// Staff accounts live on the Staff page
const STAFF_ROLES = 'Admin,Owner,Cashier'

/** One list row, whatever list it came from */
type Row = {
  id: string
  name: string
  sub?: React.ReactNode
  /** Marks someone who ordered without an account */
  guest?: boolean
  /** End-side figure: a tab balance or a points balance */
  figure?: React.ReactNode
}

/**
 * Customers as a master-detail split: everyone on the start side (the
 * directory, or just those who owe, or just loyalty members), one person's
 * hub on the end side. Points and tab balances ride along on the rows so
 * the list already answers "who owes" and "who is a member". The guests —
 * people who ordered without an account, gathered by Ordering from their
 * orders — are a view of their own, with their orders on the end side.
 */
export function Customers() {
  const t = useT()
  const locale = useLocale()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const query = (search.q ?? '').trim()
  const features = useFeatures()
  // A view whose module is off (a /loyalty or /accounts link from before) is the whole list
  const filter = allowedFilter(search.filter, features)
  const guestsView = filter === 'guests'
  const [nowMs] = useState(() => Date.now())

  const select = (customer: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, customer }) })
  const selectGuest = (guest: string | undefined) =>
    navigate({ search: (prev) => ({ ...prev, guest }) })
  const setFilter = (next: CustomerFilter | undefined) =>
    navigate({ search: (prev) => ({ ...prev, filter: next }) })

  // Balances and points for the row figures, and for the Owing / Members lists
  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAccounts(),
    enabled: features.tabs,
  })
  const members = useLoyaltyAccounts(0, 1000)
  const balanceById = useMemo(
    () => new Map((accounts.data ?? []).map((a) => [a.customerId, a.balance])),
    [accounts.data]
  )
  const memberById = useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m])),
    [members.data]
  )

  // The directory, a page at a time as the list is scrolled
  const directory = useInfiniteQuery({
    queryKey: [...customersKeys.lists(), 'directory', query],
    queryFn: ({ pageParam }) =>
      customersService.getCustomers({
        first: pageParam,
        max: PAGE_SIZE,
        search: query || undefined,
        excludeRole: STAFF_ROLES,
      }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.length === PAGE_SIZE ? pages.length * PAGE_SIZE : undefined,
    enabled: !filter,
  })
  const count = useCustomerCount(query || undefined)

  // Guests, paged the same way; Ordering folds their orders into one row
  // per phone number, most recent first
  const guests = useInfiniteQuery({
    queryKey: [{ _id: 'getGuests' }, 'infinite', query],
    queryFn: async ({ pageParam }) => {
      const { data } = await getGuests({
        query: {
          'api-version': API_VERSION,
          pageIndex: pageParam,
          pageSize: PAGE_SIZE,
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

  const rows = useMemo<Row[]>(() => {
    const q = query.toLowerCase()
    const figureFor = (id: string) => {
      const balance = balanceById.get(id) ?? 0
      const member = memberById.get(id)
      if (balance > 0) {
        return (
          <span className='text-destructive font-medium tabular-nums'>
            {formatEgp(balance)}
          </span>
        )
      }
      if (member) {
        return (
          <span
            className='text-xs font-medium tabular-nums'
            style={{ color: tierColors[member.currentTier] }}
          >
            {member.pointsBalance.toLocaleString(locale)} {t('points')}
          </span>
        )
      }
      return undefined
    }
    if (filter === 'owing') {
      return (accounts.data ?? [])
        .filter((a) => a.balance > 0)
        .filter((a) => !q || (a.customerName ?? '').toLowerCase().includes(q))
        .sort((a, b) => b.balance - a.balance)
        .map((a) => ({
          id: a.customerId,
          name: a.customerName || t('unknownCustomer'),
          sub:
            t('lastActivity') +
            ' ' +
            new Date(a.updatedAt).toLocaleDateString(locale),
          figure: (
            <span className='text-destructive font-medium tabular-nums'>
              {formatEgp(a.balance)}
            </span>
          ),
        }))
    }
    if (filter === 'guests') {
      return guestRows.map((g) => ({
        id: g.key ?? '',
        name: g.name || t('guestBadge'),
        guest: true,
        sub: (
          <>
            {g.phone && <span dir='ltr'>{g.phone}</span>}
            {' · '}
            {t('guestOrderCount', { count: Number(g.orderCount ?? 0) })}
            {' · '}
            {relativeTime(g.lastOrderAt, nowMs, t, locale)}
          </>
        ),
        figure: (
          <span className='text-xs font-medium tabular-nums'>
            {formatEgp(g.totalSpent)}
          </span>
        ),
      }))
    }
    if (filter === 'members') {
      return (members.data ?? [])
        .filter(
          (m) => !q || (m.userDisplayName ?? '').toLowerCase().includes(q)
        )
        .sort((a, b) => b.pointsBalance - a.pointsBalance)
        .map((m) => ({
          id: m.userId,
          name: m.userDisplayName || t('unknownCustomer'),
          sub: t(tierNameKeys[m.currentTier]),
          figure: figureFor(m.userId),
        }))
    }
    return (directory.data?.pages.flat() ?? []).map((c) => ({
      id: c.id,
      name: getCustomerDisplayName(c),
      sub: c.phoneNumber || c.email,
      figure: figureFor(c.id),
    }))
  }, [
    filter,
    query,
    locale,
    accounts.data,
    members.data,
    directory.data,
    guestRows,
    nowMs,
    balanceById,
    memberById,
    t,
  ])

  const listQuery =
    filter === 'owing'
      ? accounts
      : filter === 'members'
        ? members
        : guestsView
          ? guests
          : directory
  // The directory and the guests load a page at a time
  const paged = guestsView ? guests : directory
  const pages = !filter || guestsView
  const owingCount = (accounts.data ?? []).filter((a) => a.balance > 0).length

  // Fetch the next page when the sentinel scrolls into view
  const sentinel = useRef<HTMLDivElement>(null)
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = paged
  useEffect(() => {
    const node = sentinel.current
    if (!node || !pages || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [pages, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allFilters: {
    value: CustomerFilter | undefined
    label: string
    count?: number
  }[] = [
    { value: undefined, label: t('all'), count: count.data },
    { value: 'owing', label: t('owing'), count: owingCount },
    { value: 'members', label: t('members'), count: members.data?.length },
    {
      value: 'guests',
      label: t('guests'),
      count:
        guests.data?.pages[0]?.totalCount != null
          ? Number(guests.data.pages[0].totalCount)
          : undefined,
    },
  ]
  // The owing and members views follow the tabs and loyalty switches
  const filters = allFilters.filter(
    (f) =>
      (f.value !== 'owing' || features.tabs) &&
      (f.value !== 'members' || features.loyalty)
  )

  return (
    <Main fixed>
      <PageHeader title={t('customers')}>
        <CustomerStats />
      </PageHeader>

      <section className='relative flex min-h-0 flex-1 gap-6'>
        <div className='flex w-full flex-col gap-2 sm:w-72 lg:w-80 2xl:w-96'>
          <div className='relative'>
            <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 h-4 w-4 -translate-y-1/2' />
            <Input
              value={search.q ?? ''}
              onChange={(e) =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    q: e.target.value || undefined,
                  }),
                })
              }
              placeholder={t('searchCustomersPlaceholder')}
              className='h-9 ps-8'
            />
          </div>
          <div className='flex flex-wrap gap-1'>
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

          {listQuery.isError ? (
            <ErrorState
              error={listQuery.error}
              onRetry={() => listQuery.refetch()}
            />
          ) : (
            <ScrollArea className='-mx-3 h-full p-3'>
              {listQuery.isLoading ? (
                [...Array(8)].map((_, i) => (
                  <Skeleton key={i} className='mb-2 h-14 rounded-md' />
                ))
              ) : rows.length === 0 ? (
                guestsView ? (
                  <EmptyState
                    compact
                    icon={UserRound}
                    title={t('noGuestsFound')}
                    description={query ? undefined : t('noGuestsHint')}
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={Users}
                    title={t('noCustomersFound')}
                  />
                )
              ) : (
                rows.map((row) => (
                  <button
                    key={row.id}
                    type='button'
                    className={cn(
                      'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start text-sm',
                      row.id ===
                        (guestsView ? search.guest : search.customer) &&
                        'sm:bg-muted'
                    )}
                    onClick={() =>
                      guestsView ? selectGuest(row.id) : select(row.id)
                    }
                  >
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate font-medium'>{row.name}</span>
                        {row.guest && (
                          <Badge variant='outline'>{t('guestBadge')}</Badge>
                        )}
                      </div>
                      {row.sub && (
                        <div className='text-muted-foreground truncate text-xs'>
                          {row.sub}
                        </div>
                      )}
                    </div>
                    {row.figure && <div className='shrink-0'>{row.figure}</div>}
                  </button>
                ))
              )}
              {pages && (
                <div
                  ref={sentinel}
                  className='flex h-8 items-center justify-center'
                >
                  {isFetchingNextPage && <Spinner />}
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {guestsView ? (
          search.guest ? (
            <div className='bg-background absolute inset-0 z-50 flex w-full flex-1 flex-col border sm:static sm:z-auto sm:rounded-lg'>
              <GuestPanel
                key={search.guest}
                guestKey={search.guest}
                guest={guestRows.find((g) => g.key === search.guest)}
                onBack={() => selectGuest(undefined)}
              />
            </div>
          ) : (
            <div className='bg-card hidden w-full flex-1 flex-col justify-center rounded-lg border sm:flex'>
              <EmptyState icon={UserRound} title={t('selectGuest')} />
            </div>
          )
        ) : search.customer ? (
          <div className='bg-background absolute inset-0 z-50 flex w-full flex-1 flex-col border sm:static sm:z-auto sm:rounded-lg'>
            <CustomerPanel
              key={search.customer}
              customerId={search.customer}
              onBack={() => select(undefined)}
            />
          </div>
        ) : (
          <div className='bg-card hidden w-full flex-1 flex-col justify-center rounded-lg border sm:flex'>
            <EmptyState icon={Users} title={t('selectCustomer')} />
          </div>
        )}
      </section>
    </Main>
  )
}
