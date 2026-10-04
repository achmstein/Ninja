import { useQuery } from '@tanstack/react-query'
import { type DeliveryTimelineStep } from '@/api/ordering'
import { getDeliveryTimelineOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { When } from '@/components/when'
import { actionLabel } from './format'

const actionDot: Record<string, string> = {
  Delivered: 'bg-emerald-500',
  CashIn: 'bg-emerald-500',
  Failed: 'bg-destructive',
  Returned: 'bg-amber-500',
  Unassigned: 'bg-muted-foreground',
  Reassigned: 'bg-amber-500',
}

/** What the step was, its riders named: "Moved from Ali to Omar" */
function StepTitle({ step }: { step: DeliveryTimelineStep }) {
  const t = useT()
  return (
    <>
      {t(actionLabel(step.action), {
        rider: step.riderName || t('riderSomeone'),
        previous: step.previousRiderName || t('riderSomeone'),
        amount: formatEgp(step.cashCollected),
      })}
    </>
  )
}

/** Who took the step: the rider from their app, or someone at the till for them */
function StepActor({ step }: { step: DeliveryTimelineStep }) {
  const t = useT()
  const byTill = step.actorRole === 'Till'
  if (step.actorName) {
    return (
      <>
        {t(byTill ? 'riderByTill' : 'riderByRider', { name: step.actorName })}
      </>
    )
  }
  return <>{t(byTill ? 'riderAtTill' : 'riderFromApp')}</>
}

/**
 * Every step of one delivery, in order: given, taken back or moved, out,
 * delivered or not (and why), brought back, cash in (and how much); each
 * with when and who. Opened from a row of a rider's history.
 */
export function TimelineDialog({
  orderId,
  onOpenChange,
}: {
  orderId: number | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const timeline = useQuery({
    ...getDeliveryTimelineOptions({
      path: { orderId: orderId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: orderId != null,
  })
  const steps = timeline.data ?? []

  return (
    <Dialog open={orderId != null} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('riderTimeline')}</DialogTitle>
          <DialogDescription>
            {t('riderTimelineOf', { id: orderId ?? '' })}
          </DialogDescription>
        </DialogHeader>

        {timeline.isError ? (
          <ErrorState
            size='section'
            title={t('riderTimelineLoadFailed')}
            error={timeline.error}
            onRetry={timeline.refetch}
          />
        ) : timeline.isLoading ? (
          <div className='flex flex-col gap-3'>
            <Skeleton className='h-10' />
            <Skeleton className='h-10' />
            <Skeleton className='h-10' />
          </div>
        ) : steps.length === 0 ? (
          <EmptyState compact title={t('riderTimelineEmpty')} />
        ) : (
          // A vertical line down the start side, a dot per step: mirrors itself in Arabic
          <ol className='relative flex flex-col gap-4 border-s ps-5'>
            {steps.map((step, index) => (
              <li key={index} className='relative'>
                <span
                  aria-hidden
                  className={cn(
                    'border-background absolute -start-[1.6rem] top-1 size-3 rounded-full border-2',
                    actionDot[step.action ?? ''] ?? 'bg-primary'
                  )}
                />
                <div className='text-sm font-medium'>
                  <StepTitle step={step} />
                </div>
                {step.action === 'Failed' && step.reason && (
                  <div className='text-sm'>“{step.reason}”</div>
                )}
                <div className='text-muted-foreground flex flex-wrap gap-x-2 text-xs'>
                  <When value={step.at} mode='dateTime' />
                  <span>·</span>
                  <StepActor step={step} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  )
}
