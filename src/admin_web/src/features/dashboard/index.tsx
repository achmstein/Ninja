import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ClipboardList,
  Gamepad2,
  DollarSign,
  ArrowRight,
  Check,
  DoorOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  getAllOrdersOptions,
  getPendingOrdersOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import {
  getActiveSessionsOptions,
  listRoomsOptions,
} from '@/api/spaces/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import {
  formatEgp,
  orderUrgency,
  relativeTime,
  urgencyTextClass,
} from '@/features/orders/status'
import { AnalyticsSection } from './components/analytics'
import { PosSalesCard } from './components/pos-sales'
import {
  ROOM_AVAILABLE,
  SESSION_ACTIVE,
  sessionBilledHours,
} from '@/features/rooms/status'

export function Dashboard() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()

  // Tick every 30s so order ages and urgency colors advance between polls
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Midnight boundary; stable across renders so the query key doesn't churn
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  // Fetch data
  const { data: pendingOrders = [], isLoading: loadingOrders } = useQuery({
    ...getPendingOrdersOptions({ query: { 'api-version': API_VERSION } }),
    // SignalR is the primary update path; this poll is only a fallback
    refetchInterval: 60_000,
  })

  const { data: todayOrdersData } = useQuery({
    ...getAllOrdersOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: 0,
        pageSize: 200,
        fromDate: todayStart.toISOString(),
      },
    }),
    refetchInterval: 60_000,
  })

  const { data: rooms = [], isLoading: loadingRooms } = useQuery({
    ...listRoomsOptions(),
    refetchInterval: 60_000,
  })

  const { data: activeSessions = [] } = useQuery({
    ...getActiveSessionsOptions(),
    refetchInterval: 60_000,
  })

  // Calculate stats (the query already returns only today's orders)
  const todayOrders = todayOrdersData?.items ?? []

  const todayRevenue = todayOrders
    .filter((o) => o.status?.toLowerCase() !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total ?? 0), 0)
  const activeSessionsCount = activeSessions.filter(
    (s) => Number(s.status) === SESSION_ACTIVE
  ).length
  const availableRoomsCount = rooms.filter(
    (r) => Number(r.displayStatus) === ROOM_AVAILABLE
  ).length

  return (
    <>
      <Header />

      <Main>
        <div className='mb-6'>
          <h2 className='text-2xl font-bold tracking-tight'>
            {t('welcomeBack')}
          </h2>
          <p className='text-muted-foreground'>{t('dashboardSubtitle')}</p>
        </div>

        {/* Stats Cards - Matching Flutter layout */}
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6'>
          <Card
            className={
              pendingOrders.length > 0
                ? 'border-destructive bg-destructive/5'
                : ''
            }
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('pendingOrders')}
              </CardTitle>
              <ClipboardList
                className={`h-4 w-4 ${
                  pendingOrders.length > 0
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  pendingOrders.length > 0 ? 'text-destructive' : ''
                }`}
              >
                {pendingOrders.length}
              </div>
              <p className='text-xs text-muted-foreground'>
                {t('waitingToBeConfirmed')}
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              activeSessionsCount > 0 ? 'border-primary bg-primary/5' : ''
            }
          >
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('activeSessions')}
              </CardTitle>
              <Gamepad2
                className={`h-4 w-4 ${
                  activeSessionsCount > 0
                    ? 'text-primary'
                    : 'text-muted-foreground'
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  activeSessionsCount > 0 ? 'text-primary' : ''
                }`}
              >
                {activeSessionsCount}
              </div>
              <p className='text-xs text-muted-foreground'>
                {t('psRoomsInUse')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('availableRooms')}
              </CardTitle>
              <DoorOpen className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{availableRoomsCount}</div>
              <p className='text-xs text-muted-foreground'>
                {t('readyForCustomers')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                {t('todaysRevenue')}
              </CardTitle>
              <DollarSign className='h-4 w-4 text-green-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-green-600'>
                {todayRevenue.toFixed(2)} {t('currency')}
              </div>
              <p className='text-xs text-muted-foreground'>
                {t('fromConfirmedOrders')}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className='grid gap-6 lg:grid-cols-2'>
          {/* Pending Orders with Quick Actions */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div>
                  <CardTitle>{t('pendingOrders')}</CardTitle>
                  <CardDescription>
                    {t('ordersWaitingForConfirmation')}
                  </CardDescription>
                </div>
                {pendingOrders.length > 0 && (
                  <Badge variant='destructive'>{pendingOrders.length}</Badge>
                )}
              </div>
              <Link to='/orders'>
                <Button variant='outline' size='sm'>
                  {t('viewAll')}
                  <ArrowRight className='ms-2 h-4 w-4 rtl:rotate-180' />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingOrders ? (
                <div className='space-y-4'>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className='h-16 w-full' />
                  ))}
                </div>
              ) : pendingOrders.length === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  <Check className='mx-auto h-12 w-12 mb-2 opacity-50' />
                  {t('noPendingOrders')}
                </div>
              ) : (
                <div className='space-y-2'>
                  {/* Glance rows only — confirming needs the line items, so
                      acting on an order happens on the board this links to */}
                  {pendingOrders.slice(0, 5).map((order) => {
                    const urgency = orderUrgency(order.date, nowMs)
                    return (
                      <Link
                        key={String(order.orderNumber)}
                        to='/orders'
                        className='hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors'
                      >
                        <div>
                          <div className='font-medium'>
                            {t('orderNumber', {
                              id: String(order.orderNumber ?? ''),
                            })}
                          </div>
                          <div
                            className={`text-xs ${urgencyTextClass(urgency)}`}
                          >
                            {relativeTime(order.date, nowMs, t, locale)}
                          </div>
                        </div>
                        <div className='font-semibold tabular-nums'>
                          {formatEgp(order.total)}
                        </div>
                      </Link>
                    )
                  })}
                  {pendingOrders.length > 5 && (
                    <Link to='/orders'>
                      <Button variant='ghost' className='w-full'>
                        {t('viewAllOrdersCount', {
                          count: pendingOrders.length,
                        })}
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Room Sessions with End Session */}
          <Card>
            <CardHeader className='flex flex-row items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div>
                  <CardTitle>{t('activeSessions')}</CardTitle>
                  <CardDescription>
                    {t('currentlyRunningSessions')}
                  </CardDescription>
                </div>
                {activeSessionsCount > 0 && (
                  <Badge>{activeSessionsCount}</Badge>
                )}
              </div>
              <Link to='/rooms'>
                <Button variant='outline' size='sm'>
                  {t('manageRooms')}
                  <ArrowRight className='ms-2 h-4 w-4 rtl:rotate-180' />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {loadingRooms ? (
                <div className='space-y-4'>
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className='h-16 w-full' />
                  ))}
                </div>
              ) : activeSessionsCount === 0 ? (
                <div className='text-center py-8 text-muted-foreground'>
                  <Gamepad2 className='mx-auto h-12 w-12 mb-2 opacity-50' />
                  {t('noActiveSessions')}
                </div>
              ) : (
                <div className='space-y-2'>
                  {activeSessions
                    .filter((s) => Number(s.status) === SESSION_ACTIVE)
                    .slice(0, 5)
                    .map((session) => {
                      const room = rooms.find(
                        (r) => Number(r.id) === Number(session.roomId)
                      )
                      return (
                        // Compact row; managing the session happens on the
                        // room's detail page it links to
                        <Link
                          key={String(session.id)}
                          to='/rooms'
                          search={{ room: Number(session.roomId) }}
                          className='hover:bg-accent flex items-center justify-between rounded-lg border p-3 transition-colors'
                        >
                          <div>
                            <div className='font-medium'>
                              {localized(room?.name) ||
                                localized(session.roomName)}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {session.customerName || t('walkIn')}
                            </div>
                          </div>
                          <div className='text-end'>
                            <div className='font-mono text-sm tabular-nums'>
                              {t('billedHoursFormat', {
                                hours: sessionBilledHours(session),
                              })}
                            </div>
                            {session.currentPlayerMode && (
                              <div className='text-muted-foreground text-xs'>
                                {t(
                                  session.currentPlayerMode === 'Multi'
                                    ? 'playerModeMulti'
                                    : 'playerModeSingle'
                                )}
                              </div>
                            )}
                          </div>
                        </Link>
                      )
                    })}
                </div>
              )}
            </CardContent>
          </Card>
          {/* POS sales for the branch's current business day */}
          <PosSalesCard />
        </div>

        <div className='mt-6'>
          <AnalyticsSection />
        </div>
      </Main>
    </>
  )
}
