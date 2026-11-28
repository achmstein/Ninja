import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ExternalLink, Hammer, Loader2, XCircle } from 'lucide-react'
import type { BuildJob, BuildRun } from '@/api/control'
import { getAppBuildOptions, getAppBuildQueryKey, startAppBuildMutation } from '@/api/control/@tanstack/react-query.gen'
import { useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

export const BUILD_PLATFORMS = ['all', 'android', 'ios'] as const
export const BUILD_TRACKS = ['internal', 'alpha', 'beta', 'production'] as const

/** Android and iOS, or one; and Play's track */
export function BuildChoice({
  platform,
  track,
  onPlatform,
  onTrack,
}: {
  platform: string
  track: string
  onPlatform: (v: string) => void
  onTrack: (v: string) => void
}) {
  const t = useT()
  return (
    <div className='flex flex-wrap gap-2'>
      <Select value={platform} onValueChange={onPlatform}>
        <SelectTrigger className='w-40' aria-label={t('buildPlatform')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>{t('buildPlatformAll')}</SelectItem>
          <SelectItem value='android'>Android</SelectItem>
          <SelectItem value='ios'>iOS</SelectItem>
        </SelectContent>
      </Select>
      {platform !== 'ios' && (
        <Select value={track} onValueChange={onTrack}>
          <SelectTrigger className='w-44' aria-label={t('buildTrack')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BUILD_TRACKS.map((v) => (
              <SelectItem key={v} value={v}>
                {t('buildTrackOn', { track: v })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

const running = (run?: BuildRun | null) => !!run && run.status !== 'completed'

/**
 * The business's own app built from here: Android to Play's track, iOS to
 * TestFlight. The last build is followed while it runs, its jobs said one by
 * one, with a link to the run on GitHub.
 */
export function AppBuildCard({ slug }: { slug: string }) {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const path = { slug }
  const [platform, setPlatform] = useState('all')
  const [track, setTrack] = useState('internal')

  const status = useQuery({
    ...getAppBuildOptions({ path }),
    // Followed while it runs, and while GitHub has not listed a run just started
    refetchInterval: (q) => {
      const s = q.state.data
      if (!s?.requestedAt) return false
      const fresh = Date.now() - new Date(s.requestedAt).getTime() < 3 * 60_000
      return running(s.run) || (!s.run && fresh) ? 15_000 : false
    },
  })
  const start = useMutation({
    ...startAppBuildMutation(),
    onSuccess: (s) => {
      queryClient.setQueryData(getAppBuildQueryKey({ path }), s)
      toast.success(t('buildStarted'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const s = status.data
  const run = s?.run
  return (
    <Card className='gap-4 lg:col-span-2'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          <Hammer className='size-4' />
          {t('buildTitle')}
        </CardTitle>
        <CardDescription>{s && !s.canBuild ? t('buildNoToken') : t('buildHint')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <BuildChoice platform={platform} track={track} onPlatform={setPlatform} onTrack={setTrack} />
          <Button
            disabled={!s?.canBuild || start.isPending || running(run)}
            onClick={() => start.mutate({ path, body: { platform, track } })}
          >
            {start.isPending ? <Spinner /> : <Hammer />}
            {t('buildStart')}
          </Button>
        </div>

        {s?.requestedAt && (
          <div className='space-y-2 rounded-lg border p-3 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span>
                {t('buildAsked', {
                  when: format.dateTime(s.requestedAt),
                  what: s.platform === 'all' ? t('buildPlatformAll') : (s.platform ?? ''),
                })}
              </span>
              {run && (
                <a
                  href={run.url}
                  target='_blank'
                  rel='noreferrer'
                  className='text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline'
                >
                  {t('buildOnGitHub')}
                  <ExternalLink className='size-3' />
                </a>
              )}
            </div>
            {s.problem && <p className='text-destructive text-xs'>{s.problem}</p>}
            {!run && !s.problem && <p className='text-muted-foreground text-xs'>{t('buildWaiting')}</p>}
            {run && <RunLine run={run} />}
            {run?.jobs.map((job) => (
              <JobLine key={job.name} job={job} track={s.track ?? 'internal'} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RunLine({ run }: { run: BuildRun }) {
  const t = useT()
  if (run.status !== 'completed')
    return (
      <p className='text-muted-foreground text-xs'>{t(run.status === 'queued' ? 'buildQueued' : 'buildRunning')}</p>
    )
  return run.conclusion === 'success' ? (
    <p className='text-xs text-emerald-600'>{t('buildDone')}</p>
  ) : (
    <p className='text-destructive text-xs'>{t('buildFailed', { conclusion: run.conclusion ?? '' })}</p>
  )
}

function JobLine({ job, track }: { job: BuildJob; track: string }) {
  const t = useT()
  if (job.conclusion === 'skipped') return null
  const icon =
    job.status !== 'completed' ? (
      <Loader2 className='text-muted-foreground size-4 animate-spin' />
    ) : job.conclusion === 'success' ? (
      <CheckCircle2 className='size-4 text-emerald-600' />
    ) : (
      <XCircle className='text-destructive size-4' />
    )
  const where = job.name === 'iOS' ? t('buildToTestFlight') : t('buildToPlay', { track })
  return (
    <div className='flex items-center gap-2'>
      {icon}
      <span className='font-medium'>{job.name}</span>
      <span className='text-muted-foreground text-xs'>
        {job.status === 'completed' && job.conclusion === 'success'
          ? where
          : job.status === 'completed'
            ? job.conclusion
            : t('buildRunning')}
      </span>
    </div>
  )
}
