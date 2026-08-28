import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BellRing,
  Check,
  CheckCircle2,
  CreditCard,
  Gamepad2,
  Loader2,
  User,
  Users,
} from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  useLocalized,
  useT,
  type TranslationKey,
} from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import {
  REQUEST_CALL_WAITER,
  REQUEST_CONTROLLER_CHANGE,
  REQUEST_RECEIPT_TO_PAY,
  REQUEST_STATUS_ACKNOWLEDGED,
  REQUEST_STATUS_PENDING,
  REQUEST_SWITCH_TO_MULTI,
  REQUEST_SWITCH_TO_SINGLE,
  serviceRequestsService,
} from './service'

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

/** Staff-facing queue of live room requests (call waiter, bill, ...). */
export function ServiceRequests() {
  const t = useT()
  const localized = useLocalized()
  const queryClient = useQueryClient()

  // 30s clock so the relative timestamps stay honest (kept in state so
  // render stays pure)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const { data: requests = [], isLoading } = useQuery({
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

  const relative = (createdAt: string): string => {
    const minutes = Math.round(
      (now - new Date(createdAt).getTime()) / 60_000
    )
    if (minutes < 1) return t('justNow')
    if (minutes < 60) return t('minutesAgo', { minutes })
    return t('hoursAgo', { hours: Math.round(minutes / 60) })
  }

  const sorted = [...requests].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  return (
    <>
      <Header />

      <Main className='flex flex-col gap-4'>
        <div>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold tracking-tight'>
              {t('requests')}
            </h1>
            {sorted.length > 0 && (
              <Badge variant='destructive' className='h-6 tabular-nums'>
                {sorted.length}
              </Badge>
            )}
          </div>
          <p className='text-muted-foreground'>{t('requestsSubtitle')}</p>
        </div>

        {isLoading ? (
          <div className='flex flex-col gap-3'>
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className='h-20 w-full' />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-3 py-24 text-center'>
            <CheckCircle2 className='h-12 w-12 text-green-600/50' />
            <p className='text-lg font-medium'>{t('allClear')}</p>
            <p className='text-sm'>{t('noPendingRequests')}</p>
          </div>
        ) : (
          <div className='flex max-w-2xl flex-col gap-3'>
            {sorted.map((request) => {
              const meta = typeMeta[request.requestType]
              const Icon = meta?.icon ?? BellRing
              const isPending = request.status === REQUEST_STATUS_PENDING
              const isAcknowledged =
                request.status === REQUEST_STATUS_ACKNOWLEDGED
              // Scope busy state to the row being acted on — a click on one
              // request must not spin/disable the buttons of every other row
              const acknowledging =
                acknowledge.isPending && acknowledge.variables === request.id
              const completing =
                complete.isPending && complete.variables === request.id
              const acting = acknowledging || completing
              return (
                <div
                  key={request.id}
                  className={`bg-card flex items-center gap-4 rounded-lg border p-4 shadow-sm ${
                    isPending ? 'border-destructive/40' : ''
                  }`}
                >
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
                      isPending
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className='size-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='truncate font-medium'>
                        {meta ? t(meta.key) : String(request.requestType)}
                      </span>
                      <Badge
                        variant={isPending ? 'destructive' : 'secondary'}
                        className='text-xs'
                      >
                        {isPending ? t('pendingStatus') : t('inProgress')}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground truncate text-sm'>
                      {localized(request.roomName)}
                      {request.userName ? ` · ${request.userName}` : ''}
                      {' · '}
                      {relative(request.createdAt)}
                    </p>
                  </div>
                  {isPending && (
                    <Button
                      size='sm'
                      variant='outline'
                      className='shrink-0'
                      disabled={acting}
                      onClick={() => acknowledge.mutate(request.id)}
                    >
                      {acknowledging ? (
                        <Loader2 className='me-1 h-4 w-4 animate-spin' />
                      ) : (
                        <Check className='me-1 h-4 w-4' />
                      )}
                      {t('acknowledge')}
                    </Button>
                  )}
                  {isAcknowledged && (
                    <Button
                      size='sm'
                      className='shrink-0'
                      disabled={acting}
                      onClick={() => complete.mutate(request.id)}
                    >
                      {completing ? (
                        <Loader2 className='me-1 h-4 w-4 animate-spin' />
                      ) : (
                        <CheckCircle2 className='me-1 h-4 w-4' />
                      )}
                      {t('markComplete')}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Main>
    </>
  )
}
