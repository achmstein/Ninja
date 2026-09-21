import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ListChecks, X } from 'lucide-react'
import type { JobDto, LaneStatus } from '@/api/control'
import {
  cancelPlatformJobMutation,
  getPlatformJobsOptions,
  getPlatformJobsQueryKey,
  getTenantQueryKey,
} from '@/api/control/@tanstack/react-query.gen'
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
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { duration, useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'

/** The verb a job carries, in the admin's language. */
export const jobActionKey: Record<string, TranslationKey> = {
  provision: 'jobProvision',
  destroy: 'jobDestroy',
  stop: 'jobStop',
  start: 'jobStart',
  suspend: 'jobSuspend',
  resume: 'jobResume',
  upgrade: 'jobUpgrade',
  rollback: 'jobRollback',
  secure: 'jobSecure',
  rotate: 'jobRotate',
  entitlements: 'jobEntitlements',
  edge: 'jobEdge',
  backup: 'jobBackup',
}

const laneKey: Record<string, TranslationKey> = { Stamp: 'laneStamp', Backup: 'laneBackup' }

const statusClass: Record<string, string> = {
  Running: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Queued: 'border-transparent bg-muted text-muted-foreground',
  Done: 'border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Failed: 'border-transparent bg-destructive/15 text-destructive',
  Cancelled: 'border-transparent bg-muted text-muted-foreground',
}

/** "upgrade → v2" or just "backup": what a job is, in one breath. */
export function JobLabel({ job }: { job: JobDto }) {
  const t = useT()
  const key = jobActionKey[job.action]
  return (
    <span>
      {key ? t(key) : job.action}
      {job.imageTag && (
        <>
          {' → '}
          <span className='font-mono' dir='ltr'>{job.imageTag}</span>
        </>
      )}
    </span>
  )
}

/** One line for the platform page: what each lane is on and how many wait. Nothing while the lines are empty. */
export function QueueSummary({ lanes }: { lanes: LaneStatus[] | undefined }) {
  const t = useT()
  if (!lanes) return null
  const busy = lanes.filter((l) => l.running || l.queued.length > 0)
  if (busy.length === 0) return null
  return (
    <div className='text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm'>
      <ListChecks className='size-3.5' />
      {busy.map((lane, i) => (
        <span key={lane.lane} className='flex items-center gap-x-2'>
          {i > 0 && <span>·</span>}
          <span>
            {t(laneKey[lane.lane])}:{' '}
            {lane.running ? (
              <>
                <JobLabel job={lane.running} />{' '}
                <Link to='/t/$slug' params={{ slug: lane.running.slug ?? '' }} className='hover:underline'>
                  {lane.running.slug}
                </Link>
              </>
            ) : (
              t('laneIdle')
            )}
            {lane.queued.length > 0 && ` · ${t('waitingCount', { count: lane.queued.length })}`}
          </span>
        </span>
      ))}
      <Link to='/' search={{ tab: 'queue' }} className='hover:underline'>
        {t('tabQueue')}
      </Link>
    </div>
  )
}

/**
 * The queue tab: each lane's running job, what waits behind it in the
 * order it will run (with a way off the line), then what ran lately.
 */
export function QueueTable() {
  const t = useT()
  const queryClient = useQueryClient()
  const [cancelling, setCancelling] = useState<JobDto | null>(null)

  const jobs = useQuery({ ...getPlatformJobsOptions({ query: { take: 50 } }), refetchInterval: 5_000 })
  const cancel = useMutation({
    ...cancelPlatformJobMutation(),
    onSuccess: (_, v) => {
      toast.success(t('jobCancelled'))
      setCancelling(null)
      queryClient.invalidateQueries({ queryKey: getPlatformJobsQueryKey() })
      if (v.path?.id !== undefined && cancelling?.slug)
        queryClient.invalidateQueries({ queryKey: getTenantQueryKey({ path: { slug: cancelling.slug } }) })
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  if (jobs.isLoading) return <Skeleton className='h-24 w-full' />
  const data = jobs.data
  if (!data) return null
  const open = data.lanes.flatMap((l) => [...(l.running ? [l.running] : []), ...l.queued])
  const nothing = open.length === 0 && data.recent.length === 0

  if (nothing) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>{t('queueEmpty')}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-6'>
      {data.lanes.map((lane) => (
        <section key={lane.lane} className='flex flex-col gap-2'>
          <h2 className='text-sm font-medium'>
            {t(laneKey[lane.lane])}
            <span className='text-muted-foreground font-normal'>
              {' · '}
              {lane.running ? t('laneRunning') : t('laneIdle')}
              {lane.queued.length > 0 && ` · ${t('waitingCount', { count: lane.queued.length })}`}
            </span>
          </h2>
          {lane.running || lane.queued.length > 0 ? (
            <JobsTable
              jobs={[...(lane.running ? [lane.running] : []), ...lane.queued]}
              onCancel={setCancelling}
              cancellingId={cancel.isPending ? Number(cancelling?.id) : undefined}
            />
          ) : (
            <p className='text-muted-foreground text-sm'>{t('laneNothingWaiting')}</p>
          )}
        </section>
      ))}

      {data.recent.length > 0 && (
        <section className='flex flex-col gap-2'>
          <h2 className='text-sm font-medium'>{t('recentJobs')}</h2>
          <JobsTable jobs={data.recent} />
        </section>
      )}

      <AlertDialog open={cancelling !== null} onOpenChange={(o) => !o && setCancelling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelJobTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelling && (
                <>
                  <JobLabel job={cancelling} /> · {cancelling.slug}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepJob')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancel.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (cancelling) cancel.mutate({ path: { id: Number(cancelling.id) } })
              }}
            >
              {cancel.isPending ? <Spinner /> : null}
              {t('cancelJob')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** Jobs in the order given: a lane's running one and its line, or what ran lately. */
function JobsTable({ jobs, onCancel, cancellingId }: { jobs: JobDto[]; onCancel?: (j: JobDto) => void; cancellingId?: number }) {
  const t = useT()
  const format = useFormat()
  return (
    <div className='rounded-lg border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-10'>#</TableHead>
            <TableHead>{t('job')}</TableHead>
            <TableHead>{t('tenant')}</TableHead>
            <TableHead>{t('status')}</TableHead>
            <TableHead>{t('requestedBy')}</TableHead>
            <TableHead>{t('when')}</TableHead>
            <TableHead>{t('took')}</TableHead>
            {onCancel && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className='text-muted-foreground tabular-nums'>{job.position ?? ''}</TableCell>
              <TableCell className='font-medium'>
                <JobLabel job={job} />
                {job.error && (
                  <div className='text-destructive max-w-96 truncate text-xs' title={job.error}>
                    {job.error}
                  </div>
                )}
              </TableCell>
              <TableCell className='font-mono text-xs'>
                {job.slug ? (
                  <Link to='/t/$slug' params={{ slug: job.slug }} className='hover:underline'>
                    {job.slug}
                  </Link>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell>
                <Badge variant='outline' className={cn(statusClass[job.status])}>
                  {t(`jobStatus${job.status}` as TranslationKey)}
                  {Number(job.attempts) > 1 && ` ×${job.attempts}`}
                </Badge>
              </TableCell>
              <TableCell className='text-muted-foreground max-w-40 truncate text-xs' title={job.requestedBy}>
                {job.requestedBy}
              </TableCell>
              <TableCell className='text-muted-foreground text-xs whitespace-nowrap'>
                {format.dateTime(job.startedAt ?? job.enqueuedAt)}
              </TableCell>
              <TableCell className='text-muted-foreground text-xs tabular-nums'>
                {job.startedAt ? duration(job.startedAt, job.finishedAt) : ''}
              </TableCell>
              {onCancel && (
                <TableCell className='text-end'>
                  {job.status === 'Queued' && (
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-8'
                      aria-label={t('cancelJob')}
                      disabled={cancellingId === Number(job.id)}
                      onClick={() => onCancel(job)}
                    >
                      {cancellingId === Number(job.id) ? <Spinner /> : <X />}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
