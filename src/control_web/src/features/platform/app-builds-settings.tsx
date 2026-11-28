import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Hammer } from 'lucide-react'
import type { AppBuildTestResult, BuildAllResult } from '@ninja/api/control'
import {
  buildAllOwnAppsMutation,
  getAppBuildSettingsOptions,
  getAppBuildSettingsQueryKey,
  saveAppBuildSettingsMutation,
  testAppBuildSettingsMutation,
} from '@ninja/api/control/@tanstack/react-query.gen'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { BuildChoice } from '@/features/tenants/app-build'

/**
 * How the own apps are built from the control app: a GitHub token allowed to
 * run the repository's workflows, and a button that builds every business's
 * own app at once (after a release, say).
 */
export function AppBuildsSettings() {
  const t = useT()
  const queryClient = useQueryClient()
  const settings = useQuery(getAppBuildSettingsOptions())
  const [token, setToken] = useState('')
  const [test, setTest] = useState<AppBuildTestResult | null>(null)
  const [platform, setPlatform] = useState('all')
  const [track, setTrack] = useState('internal')
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<BuildAllResult | null>(null)

  const save = useMutation({
    ...saveAppBuildSettingsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getAppBuildSettingsQueryKey(), saved)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAppBuild' }] })
      setToken('')
      setTest(null)
      toast.success(t('buildsTokenSaved'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const run = useMutation({
    ...testAppBuildSettingsMutation(),
    onSuccess: setTest,
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const all = useMutation({
    ...buildAllOwnAppsMutation(),
    onSuccess: (r) => {
      setResult(r)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAppBuild' }] })
      toast.success(t('buildsAllStarted', { count: r.started.length }))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  if (!settings.data) return <Skeleton className='h-48 w-full' />
  const saved = settings.data

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('buildsToken')}</CardTitle>
          <CardDescription>{t('buildsTokenHint', { repository: saved.repository })}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='max-w-md space-y-2'>
            <Label htmlFor='github-token'>
              {saved.set ? t('buildsTokenReplace', { hint: saved.hint }) : t('buildsTokenLabel')}
            </Label>
            <Input
              id='github-token'
              dir='ltr'
              type='password'
              autoComplete='off'
              placeholder='github_pat_…'
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              disabled={!token.trim() || save.isPending}
              onClick={() => save.mutate({ body: { gitHubToken: token.trim() } })}
            >
              {save.isPending && <Spinner />}
              {t('save')}
            </Button>
            {saved.set && (
              <>
                <Button variant='outline' disabled={run.isPending} onClick={() => run.mutate({})}>
                  {run.isPending && <Spinner />}
                  {t('firebaseTest')}
                </Button>
                <Button
                  variant='ghost'
                  disabled={save.isPending}
                  onClick={() => save.mutate({ body: { clearToken: true } })}
                >
                  {t('firebaseClear')}
                </Button>
              </>
            )}
          </div>
          {test && <p className={test.ok ? 'text-sm text-emerald-600' : 'text-destructive text-sm'}>{test.detail}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('buildsAll')}</CardTitle>
          <CardDescription>{t('buildsAllHint')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <BuildChoice platform={platform} track={track} onPlatform={setPlatform} onTrack={setTrack} />
            <Button disabled={!saved.set || all.isPending} onClick={() => setConfirm(true)}>
              {all.isPending ? <Spinner /> : <Hammer />}
              {t('buildsAllStart')}
            </Button>
          </div>
          {result && (
            <div className='space-y-1 text-sm'>
              {result.started.length > 0 && (
                <p className='text-emerald-600'>{t('buildsAllStartedFor', { slugs: result.started.join(', ') })}</p>
              )}
              {result.refused.map((r) => (
                <p key={r.slug} className='text-destructive'>
                  {r.slug}: {r.reason}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('buildsAllConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>{t('buildsAllConfirmHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => all.mutate({ body: { platform, track } })}>
              {t('buildsAllStart')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
