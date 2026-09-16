import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import {
  BellRing,
  Check,
  CheckCircle2,
  CreditCard,
  Gamepad2,
  User,
  Users,
} from 'lucide-react'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import {
  QueueCard,
  urgencyFor,
  urgencyTextClass,
} from '@/components/queue-card'
import { relativeTime } from '@/features/orders/status'
import {
  REQUEST_CALL_WAITER,
  REQUEST_CONTROLLER_CHANGE,
  REQUEST_RECEIPT_TO_PAY,
  REQUEST_STATUS_PENDING,
  REQUEST_SWITCH_TO_MULTI,
  REQUEST_SWITCH_TO_SINGLE,
  serviceRequestsService,
  type ServiceRequest,
} from './service'

const route = getRouteApi('/_authenticated/requests/')

const typeMeta: Record<
  number,
  { key: TranslationKey; icon: React.ComponentType<{ className?: string }> }
> = {
  [REQUEST_CALL_WAITER]: { key: 'callWaiter', icon: BellRing },
  [REQUEST_CONTROLLER_CHANGE]: { key: 'controllerChange', icon: Gamepad2 },
  [REQUEST_RECEIPT_TO_PAY]: { key: 'receiptToPay', icon: CreditCard },
  [REQUEST_SWITCH_TO_MULTI]: { key: 'switchToMulti', icon: Users },
  [REQUEST_SWITCH_TO_SINGLE]: { key: 'switchToSingle', icon: User },
}

// A waiter call ages faster than a drinks order: amber at 2 min, red at 5
const WARN_AFTER_MINUTES = 2
const DELAYED_AFTER_MINUTES = 5

/**
 * The queue of live room requests (call waiter, bill, controller…), as
 * tickets that glow as they age — the same shape as the orders board. One
 * step to say you're on it, one to close it.
 */
export function ServiceRequests() {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  // 30s clock so ages and urgency advance between refetches
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const requestsQuery = useQuery({
    queryKey: ['service-requests'],
    queryFn: () => serviceRequestsService.pending(),
    // SignalR ServiceRequestCreated invalidates this; poll is a fallback
    refetchInterval: 30_000,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['service-requests'] })

  const acknowledge = useMutation({
    mutationFn: (id: number) => serviceRequestsService.acknowledge(id),
    onSuccess: invalidate,
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const complete = useMutation({
    mutationFn: (id: number) => serviceRequestsService.complete(id),
    onSuccess: invalidate,
    onError: () => toast.error(t('somethingWentWrong')),
  })

  const all = [...(requestsQuery.data ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )
  const counts = new Map<number, number>()
  for (const request of all) {
    counts.set(request.requestType, (counts.get(request.requestType) ?? 0) + 1)
  }
  const visible = search.type
    ? all.filter((request) => request.requestType === search.type)
    : all
  const types = Object.keys(typeMeta)
    .map(Number)
    .filter((type) => (counts.get(type) ?? 0) > 0 || type === search.type)

  return (
    <Main>
      <PageHeader
        title={t('requests')}
        badge={
          all.length > 0 && (
            <Badge variant='destructive' className='h-6 tabular-nums'>
              {all.length}
            </Badge>
          )
        }
      >
        {types.length > 1 && (
          <ToggleGroup
            type='single'
            variant='outline'
            size='sm'
            value={search.type ? String(search.type) : 'all'}
            onValueChange={(value) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  type: value && value !== 'all' ? Number(value) : undefined,
                }),
              })
            }
            aria-label={t('requestFilterAll')}
            className='w-fit'
          >
            <ToggleGroupItem value='all' className='px-3'>
              {t('all')}
            </ToggleGroupItem>
            {types.map((type) => {
              const Icon = typeMeta[type].icon
              return (
                <ToggleGroupItem
                  key={type}
                  value={String(type)}
                  className='gap-1.5 px-3'
                >
                  <Icon className='size-3.5' />
                  {t(typeMeta[type].key)}
                  <span className='text-muted-foreground tabular-nums'>
                    {counts.get(type) ?? 0}
                  </span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
        )}
      </PageHeader>

      {requestsQuery.isError ? (
        <ErrorState
          error={requestsQuery.error}
          onRetry={() => requestsQuery.refetch()}
        />
      ) : requestsQuery.isLoading ? (
        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className='h-36' />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('allClear')} />
      ) : (
        <div className='grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {visible.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              nowMs={now}
              // Scope busy state to the card being acted on
              acknowledging={
                acknowledge.isPending && acknowledge.variables === request.id
              }
              completing={
                complete.isPending && complete.variables === request.id
              }
              onAcknowledge={() => acknowledge.mutate(request.id)}
              onComplete={() => complete.mutate(request.id)}
              placeName={localized(request.roomName)}
              age={relativeTime(request.createdAt, now, t, locale)}
            />
          ))}
        </div>
      )}
    </Main>
  )
}

function RequestCard({
  request,
  nowMs,
  acknowledging,
  completing,
  onAcknowledge,
  onComplete,
  placeName,
  age,
}: {
  request: ServiceRequest
  nowMs: number
  acknowledging: boolean
  completing: boolean
  onAcknowledge: () => void
  onComplete: () => void
  placeName: string
  age: string
}) {
  const t = useT()
  const meta = typeMeta[request.requestType]
  const Icon = meta?.icon ?? BellRing
  const isPending = request.status === REQUEST_STATUS_PENDING
  const urgency = urgencyFor(
    request.createdAt,
    nowMs,
    WARN_AFTER_MINUTES,
    DELAYED_AFTER_MINUTES
  )
  const acting = acknowledging || completing

  return (
    <QueueCard urgency={urgency}>
      <div className='flex items-start justify-between gap-2'>
        {/* The place is what staff walk to — it leads, and it links */}
        <Link
          to='/places'
          search={{ place: request.placeId ?? undefined }}
          className='text-lg font-semibold underline-offset-4 hover:underline'
        >
          {placeName || t('place')}
        </Link>
        <span className={`text-xs ${urgencyTextClass(urgency)}`}>{age}</span>
      </div>
      <div className='mt-2 flex items-center gap-2'>
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
            isPending
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          <Icon className='size-4' />
        </span>
        <div className='min-w-0'>
          <div className='font-medium'>
            {meta ? t(meta.key) : String(request.requestType)}
          </div>
          <div className='text-muted-foreground truncate text-sm'>
            {request.userName || t('guest')}
            {!isPending && ` · ${t('inProgress')}`}
          </div>
        </div>
      </div>

      <div className='mt-4 flex gap-2'>
        {isPending && (
          <Button
            variant='outline'
            className='flex-1'
            disabled={acting}
            onClick={onAcknowledge}
          >
            {acknowledging ? (
              <Spinner className='me-1' />
            ) : (
              <Check className='me-1 h-4 w-4' />
            )}
            {t('onIt')}
          </Button>
        )}
        <Button className='flex-1' disabled={acting} onClick={onComplete}>
          {completing ? (
            <Spinner className='me-1' />
          ) : (
            <CheckCircle2 className='me-1 h-4 w-4' />
          )}
          {t('done')}
        </Button>
      </div>
    </QueueCard>
  )
}
