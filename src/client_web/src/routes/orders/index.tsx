import { useEffect, useRef, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CircleAlert, Loader2, ReceiptText, Star } from 'lucide-react'
import {
  getOrdersByUser,
  type Order,
  type OrderSummary,
} from '@/api/ordering'
import {
  getOrderOptions,
  getOrdersByUserOptions,
  rateOrderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { businessDayStart } from '@/lib/business-day'
import {
  dayStartHour,
  isOvernightShift,
  useSelectedBranch,
} from '@/lib/branch'
import {
  useLanguage,
  useLocalized,
  usePrice,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { SignInOptions } from '@/components/sign-in-options'
import { useGuestStore } from '@/stores/guest-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

export const Route = createFileRoute('/orders/')({
  component: OrdersRoute,
})

/**
 * Open to guests: the API returns the orders placed under the guest id this
 * browser sends. Only a visitor who has neither an account nor a guest order
 * has nothing to show, and they get the sign-in prompt.
 */
function OrdersRoute() {
  const auth = useAuth()
  const guestId = useGuestStore((s) => s.guestId)

  if (!auth.isAuthenticated && !auth.isLoading && !guestId) {
    return <SignedOutPrompt />
  }

  return <OrdersPage />
}

function SignedOutPrompt() {
  const t = useT()
  return (
    <div className='flex h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center'>
      <ReceiptText className='text-muted-foreground/40 h-12 w-12' />
      <p className='text-muted-foreground'>{t('noGuestOrdersYet')}</p>
      <SignInOptions />
    </div>
  )
}

/** Status dot colors mirroring the mobile app's _StatusDot. */
function statusDotClass(status: string | undefined | null): string {
  switch (status?.toLowerCase()) {
    case 'confirmed':
      return 'bg-green-600 dark:bg-green-500'
    case 'cancelled':
      return 'bg-destructive'
    default:
      return 'bg-orange-500'
  }
}

const HISTORY_PAGE_SIZE = 15

function OrdersPage() {
  const t = useT()
  const price = usePrice()
  const branch = useSelectedBranch()

  // Today = the branch's current business day (overnight shifts included).
  // Guests get the same live updates as anyone else: the hub puts them in a
  // group keyed on their guest id, so no polling is needed here.
  const todayQuery = useQuery(
    getOrdersByUserOptions({
      query: {
        'api-version': API_VERSION,
        pageIndex: 0,
        pageSize: 50,
        fromDate: businessDayStart(branch).toISOString(),
      },
    })
  )
  const todayOrders = todayQuery.data?.items ?? []
  const totalSpent = todayOrders
    .filter((order) => order.status?.toLowerCase() === 'confirmed')
    .reduce(
      (sum, order) =>
        sum + Number(order.total ?? 0) - Number(order.loyaltyDiscount ?? 0),
      0
    )

  const historyQuery = useInfiniteQuery({
    queryKey: [{ _id: 'getOrdersByUser', scope: 'history' }],
    queryFn: async ({ pageParam }) => {
      const { data } = await getOrdersByUser({
        query: {
          'api-version': API_VERSION,
          pageIndex: pageParam,
          pageSize: HISTORY_PAGE_SIZE,
        },
        throwOnError: true,
      })
      return data
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) =>
      last.hasNextPage ? pages.length : undefined,
  })
  const historyOrders =
    historyQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('orders')}</h1>

      <Tabs defaultValue='today'>
        <TabsList className='w-full'>
          <TabsTrigger value='today' className='flex-1'>
            {t('todaysOrders')}
          </TabsTrigger>
          <TabsTrigger value='history' className='flex-1'>
            {t('previousOrders')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='today' className='mt-2'>
          {todayQuery.isLoading ? (
            <OrdersSkeleton />
          ) : todayQuery.isError ? (
            <ErrorState onRetry={() => todayQuery.refetch()} />
          ) : todayOrders.length === 0 ? (
            <EmptyState title={t('noOrdersToday')} />
          ) : (
            <div className='flex flex-col'>
              {/* Count + total spent summary (mobile parity) */}
              <div className='flex items-baseline justify-between py-2 text-[13px]'>
                <span className='text-muted-foreground'>
                  {t('todayOrdersCount', { count: todayOrders.length })}
                </span>
                <span className='font-semibold'>
                  {t('totalSpent', { amount: price(totalSpent) })}
                </span>
              </div>
              <div className='divide-y'>
                {todayOrders.map((order) => (
                  <OrderTile key={String(order.orderNumber)} order={order} />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value='history' className='mt-2'>
          {historyQuery.isLoading ? (
            <OrdersSkeleton />
          ) : historyQuery.isError ? (
            <ErrorState onRetry={() => historyQuery.refetch()} />
          ) : historyOrders.length === 0 ? (
            <EmptyState title={t('noOrdersYet')} />
          ) : (
            <HistoryList
              orders={historyOrders}
              hasMore={historyQuery.hasNextPage}
              isFetchingMore={historyQuery.isFetchingNextPage}
              onLoadMore={() => historyQuery.fetchNextPage()}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Mirrors OrderCard's layout: status dot and time on one line with the total
 *  pushed to the end, then the item lines beneath. */
function OrdersSkeleton() {
  return (
    <div className='flex flex-col pt-2'>
      {[...Array(4)].map((_, i) => (
        <div key={i} className='flex flex-col gap-2 py-3'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-2.5 shrink-0 rounded-full' />
            <Skeleton className='h-4 w-16' />
            <Skeleton className='h-3 w-20' />
            <Skeleton className='ms-auto h-4 w-14 shrink-0' />
          </div>
          <Skeleton className='h-3 w-3/5' />
          <Skeleton className='h-3 w-2/5' />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className='flex h-[40svh] flex-col items-center justify-center gap-2 text-center'>
      <ReceiptText className='text-muted-foreground h-16 w-16' />
      <p className='text-lg'>{title}</p>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  return (
    <div className='flex h-[40svh] flex-col items-center justify-center gap-3 text-center'>
      <CircleAlert className='text-muted-foreground h-12 w-12' />
      <p>{t('failedToLoadOrders')}</p>
      <Button variant='outline' className='rounded-full' onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  )
}

// ── History: grouped by business day (shift-aware, mobile parity) ──

function HistoryList({
  orders,
  hasMore,
  isFetchingMore,
  onLoadMore,
}: {
  orders: OrderSummary[]
  hasMore: boolean | undefined
  isFetchingMore: boolean
  onLoadMore: () => void
}) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branch = useSelectedBranch()
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasMore && !isFetchingMore) {
        onLoadMore()
      }
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isFetchingMore, onLoadMore])

  // For overnight shifts, orders before the start hour belong to the
  // previous day's shift (same rule as the mobile app)
  const startHour = dayStartHour(branch)
  const overnight = isOvernightShift(branch)
  const shiftDay = (date: Date): Date => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (overnight && date.getHours() < startHour) day.setDate(day.getDate() - 1)
    return day
  }
  const todayShift = shiftDay(new Date())
  const yesterdayShift = new Date(todayShift)
  yesterdayShift.setDate(yesterdayShift.getDate() - 1)

  const labelFor = (day: Date): string => {
    if (day.getTime() === todayShift.getTime()) return t('today')
    if (day.getTime() === yesterdayShift.getTime()) return t('yesterday')
    return day.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  const groups: Array<{ label: string; orders: OrderSummary[] }> = []
  for (const order of orders) {
    const label = order.date ? labelFor(shiftDay(new Date(order.date))) : ''
    const group = groups.at(-1)
    if (group && group.label === label) {
      group.orders.push(order)
    } else {
      groups.push({ label, orders: [order] })
    }
  }

  return (
    <div className='flex flex-col'>
      {groups.map((group) => (
        <div key={group.label} className='flex flex-col'>
          <h3 className='text-muted-foreground pt-4 pb-1 text-[13px] font-semibold'>
            {group.label}
          </h3>
          <div className='divide-y'>
            {group.orders.map((order) => (
              <OrderTile key={String(order.orderNumber)} order={order} />
            ))}
          </div>
        </div>
      ))}
      <div ref={sentinelRef} className='flex justify-center py-2'>
        {isFetchingMore && (
          <Loader2 className='text-muted-foreground h-5 w-5 animate-spin' />
        )}
      </div>
    </div>
  )
}

// ── Order tile: status dot + time + inline details (mobile parity) ──

function OrderTile({ order }: { order: OrderSummary }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const language = useLanguage((s) => s.language)

  // Items, note, and rating are auto-fetched like the mobile app; live
  // status updates invalidate this via the app-wide hub
  const detailQuery = useQuery(
    getOrderOptions({
      path: { orderId: Number(order.orderNumber) },
      query: { 'api-version': API_VERSION },
    })
  )

  const discount = Number(order.loyaltyDiscount ?? 0)

  return (
    <div className='flex flex-col gap-2 py-3'>
      <div className='flex items-center gap-2'>
        <span
          className={`size-2.5 shrink-0 rounded-full ${statusDotClass(order.status)}`}
        />
        <span className='text-[15px] font-semibold'>
          {order.date &&
            new Date(order.date).toLocaleTimeString(
              language === 'ar' ? 'ar-EG' : 'en-US',
              { hour: 'numeric', minute: '2-digit' }
            )}
        </span>
        {order.roomName && (
          <span className='text-muted-foreground truncate text-[13px]'>
            • {localized(order.roomName)}
          </span>
        )}
        <div className='ms-auto shrink-0 text-end'>
          <div className='text-[15px] font-bold tabular-nums'>
            {price(Number(order.total ?? 0) - discount)}
          </div>
          {discount > 0 && (
            <div className='flex items-center justify-end gap-0.5 text-xs text-green-600 dark:text-green-500'>
              <Star className='h-3 w-3 fill-current' />
              {t('discountFormat', { price: discount.toFixed(2) })}
            </div>
          )}
          <PaidPill order={order} />
        </div>
      </div>

      {detailQuery.isLoading ? (
        <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
      ) : detailQuery.isError ? (
        <p className='text-destructive text-[13px]'>
          {t('failedToLoadDetails')}
        </p>
      ) : (
        detailQuery.data && <OrderTileDetails order={detailQuery.data} />
      )}
    </div>
  )
}

/**
 * What the till did with the bill this order was on, projected by Ordering
 * from Sales' receipt: paid (and on which receipt), on the customer's tab,
 * refunded, voided (the bill was thrown out, so it will never be paid) —
 * or still unpaid once staff confirmed it. A submitted or cancelled order
 * carries no pill.
 */
function PaidPill({ order }: { order: OrderSummary }) {
  const t = useT()
  const price = usePrice()
  const refunded = Number(order.refundedAmount ?? 0)
  if (order.paidAt == null) {
    if (order.voidedAt != null) {
      return (
        <Badge variant='outline' className='text-muted-foreground mt-1'>
          {t('voided')}
        </Badge>
      )
    }
    return order.status?.toLowerCase() === 'confirmed' ? (
      <Badge variant='outline' className='mt-1'>
        {t('unpaid')}
      </Badge>
    ) : null
  }
  const receipt =
    order.receiptNumber != null
      ? ` ${t('receiptShort', { number: Number(order.receiptNumber) })}`
      : ''
  return (
    <div className='mt-1 flex flex-wrap items-center justify-end gap-1'>
      {/* The receipt is a tap away once there is one */}
      {order.ticketId != null ? (
        <Link to='/receipts/$ticketId' params={{ ticketId: String(order.ticketId) }}>
          <Badge variant='secondary' className='tabular-nums'>
            {order.paidWith === 'Account' ? t('onYourTab') : t('paid')}
            {receipt}
          </Badge>
        </Link>
      ) : (
        <Badge variant='secondary' className='tabular-nums'>
          {order.paidWith === 'Account' ? t('onYourTab') : t('paid')}
          {receipt}
        </Badge>
      )}
      {refunded > 0 && (
        <Badge variant='outline' className='text-destructive tabular-nums'>
          {t('refunded')} −{price(refunded)}
        </Badge>
      )}
    </div>
  )
}

function OrderTileDetails({ order }: { order: Order }) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const [rateOpen, setRateOpen] = useState(false)

  const rating = order.rating?.ratingValue
  // Rating is still account-only server-side, so don't offer a guest a button
  // that would come back 401
  const canBeRated =
    auth.isAuthenticated &&
    order.status?.toLowerCase() === 'confirmed' &&
    rating == null

  return (
    <div className='flex flex-col gap-1'>
      {(order.orderItems ?? []).map((item, index) => (
        <div key={index}>
          <div className='flex items-baseline gap-1 text-sm'>
            <span className='text-muted-foreground'>
              {Number(item.units ?? 0)}x
            </span>
            <span className='min-w-0 flex-1'>
              {localized(item.productName)}
            </span>
          </div>
          {item.customizationsDescription && (
            <p className='text-muted-foreground ms-6 text-xs'>
              {localized(item.customizationsDescription)}
            </p>
          )}
          {item.specialInstructions && (
            <p className='text-muted-foreground ms-6 text-xs italic'>
              "{item.specialInstructions}"
            </p>
          )}
        </div>
      ))}

      {order.customerNote && (
        <p className='text-muted-foreground text-[13px]'>
          {t('noteWithText', { notes: order.customerNote })}
        </p>
      )}

      {rating != null ? (
        <div className='pt-1'>
          <div className='flex items-center gap-1'>
            <span className='text-muted-foreground text-[13px]'>
              {t('yourRating')}
            </span>
            <StarsDisplay value={Number(rating)} />
          </div>
          {order.rating?.comment && (
            <p className='text-muted-foreground text-[13px]'>
              "{order.rating.comment}"
            </p>
          )}
        </div>
      ) : (
        canBeRated && (
          <>
            <button
              type='button'
              className='text-muted-foreground flex items-center gap-1 pt-1 text-[13px]'
              onClick={() => setRateOpen(true)}
            >
              <Star className='h-4 w-4' />
              {t('rateThisOrder')}
            </button>
            <RatingSheet
              orderId={Number(order.orderNumber)}
              open={rateOpen}
              onOpenChange={setRateOpen}
            />
          </>
        )
      )}
    </div>
  )
}

function StarsDisplay({ value }: { value: number }) {
  return (
    <span className='text-muted-foreground flex gap-0.5'>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${star <= value ? 'fill-current' : 'opacity-40'}`}
        />
      ))}
    </span>
  )
}

// ── Rating bottom sheet (mobile parity) ──

const RATING_LABELS: Record<number, TranslationKey> = {
  1: 'ratingPoor',
  2: 'ratingFair',
  3: 'ratingGood',
  4: 'ratingVeryGood',
  5: 'ratingExcellent',
}

function RatingSheet({
  orderId,
  open,
  onOpenChange,
}: {
  orderId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  const rateOrder = useMutation({
    ...rateOrderMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrder' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOrdersByUser' }] })
      onOpenChange(false)
    },
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='bottom'
        className='mx-auto max-w-lg gap-0 rounded-t-2xl border-t-0 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
      >
        <div className='bg-muted-foreground mx-auto mb-4 h-1 w-10 rounded-full' />

        <SheetHeader className='p-0 text-start'>
          <SheetTitle className='pe-8 text-xl font-bold'>
            {t('rateYourOrder')}
          </SheetTitle>
        </SheetHeader>

        <div className='mt-6 flex justify-center gap-1'>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type='button'
              disabled={rateOrder.isPending}
              onClick={() => setRating(star)}
              aria-label={`${star} stars`}
            >
              <Star
                className={`h-10 w-10 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
              />
            </button>
          ))}
        </div>
        <p className='text-muted-foreground mt-2 text-center text-[15px]'>
          {t(RATING_LABELS[rating])}
        </p>

        <p className='mt-6 text-sm font-semibold'>{t('yourReviewOptional')}</p>
        <Textarea
          rows={3}
          maxLength={500}
          className='mt-2'
          placeholder={t('shareYourExperience')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {rateOrder.isError && (
          <div className='bg-destructive/10 text-destructive mt-4 flex items-center gap-2 rounded-lg p-3 text-[13px]'>
            <CircleAlert className='h-4 w-4 shrink-0' />
            {t('failedToPlaceOrder')}
          </div>
        )}

        <Button
          size='lg'
          className='mt-6 w-full rounded-full font-bold'
          disabled={rateOrder.isPending}
          onClick={() =>
            rateOrder.mutate({
              path: { orderId },
              body: { ratingValue: rating, comment: comment.trim() || null },
              headers: { 'x-requestid': crypto.randomUUID() },
              query: { 'api-version': API_VERSION },
            })
          }
        >
          {rateOrder.isPending ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            t('submitRating')
          )}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
