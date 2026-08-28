import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ClipboardList,
  Gamepad2,
  DollarSign,
  ArrowRight,
  Check,
  X,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  cancelOrderMutation,
  confirmOrderMutation,
  getAllOrdersOptions,
  getPendingOrdersOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import {
  getActiveSessionsOptions,
  listRoomsOptions,
} from '@/api/rooms/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'
import {
  ROOM_AVAILABLE,
  SESSION_ACTIVE,
  sessionBilledHours,
} from '@/features/rooms/status'
import { toast } from '@/lib/toast'

function generateRequestId(): string {
  return crypto.randomUUID()
}

export function Dashboard() {
  const t = useT()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null)

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

  // Mutations
  const invalidateOrders = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllOrders' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getPendingOrders' }] })
  }

  const confirmMutation = useMutation({
    ...confirmOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('orderConfirmed'))
    },
    onError: () => {
      toast.error(t('failedToConfirmOrder'))
    },
  })

  const cancelMutation = useMutation({
    ...cancelOrderMutation(),
    onSuccess: () => {
      invalidateOrders()
      toast.success(t('orderCancelled'))
    },
    onError: () => {
      toast.error(t('failedToCancelOrder'))
    },
  })

  const mutateOrder = (
    mutation: typeof confirmMutation,
    orderNumber: number
  ) =>
    mutation.mutate({
      body: { orderNumber },
      headers: { 'x-requestid': generateRequestId() },
      query: { 'api-version': API_VERSION },
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

  const handleCancelOrder = () => {
    if (cancelOrderId) {
      mutateOrder(cancelMutation, cancelOrderId)
      setCancelOrderId(null)
    }
  }

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
                <div className='space-y-4'>
                  {pendingOrders.slice(0, 5).map((order) => (
                    <div
                      key={String(order.orderNumber)}
                      className='flex items-center justify-between rounded-lg border p-3'
                    >
                      <div>
                        <div className='font-medium'>
                          {t('orderNumber', {
                            id: String(order.orderNumber ?? ''),
                          })}
                        </div>
                        <div className='text-sm text-muted-foreground'>
                          {formatEgp(order.total)}
                        </div>
                        <div className='text-xs text-muted-foreground'>
                          {order.date &&
                            new Date(order.date).toLocaleTimeString(locale)}
                        </div>
                      </div>
                      <div className='flex items-center gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() =>
                            setCancelOrderId(Number(order.orderNumber))
                          }
                          disabled={cancelMutation.isPending}
                        >
                          <X className='h-4 w-4 me-1' />
                          {t('cancel')}
                        </Button>
                        <Button
                          size='sm'
                          onClick={() =>
                            mutateOrder(
                              confirmMutation,
                              Number(order.orderNumber)
                            )
                          }
                          disabled={confirmMutation.isPending}
                        >
                          <Check className='h-4 w-4 me-1' />
                          {t('confirm')}
                        </Button>
                      </div>
                    </div>
                  ))}
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
                <div className='space-y-4'>
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
                              {room?.name?.en ?? session.roomName?.en}
                            </div>
                            <div className='text-muted-foreground text-sm'>
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
                                {session.currentPlayerMode}
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
        </div>
      </Main>

      {/* Cancel Order Confirmation */}
      <AlertDialog
        open={cancelOrderId !== null}
        onOpenChange={(open) => !open && setCancelOrderId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelOrderQuestion')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelOrderConfirmation')} {t('cannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('noKeep')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {t('yesCancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
