import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FirebaseTestResult } from '@/api/control'
import {
  getFirebaseSettingsOptions,
  getFirebaseSettingsQueryKey,
  saveFirebaseSettingsMutation,
  testFirebaseMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { readFileText } from '@/lib/files'
import { useFormat } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { AppBuildsSettings } from './app-builds-settings'

/**
 * The service account the businesses' own apps are made in Firebase with:
 * a Google key file with Firebase Admin on the platform's project. Pushes keep
 * their own credentials on the host; this one only finds or makes a business's
 * apps there and downloads their files (the App tab of its page).
 */
export function FirebaseSettings() {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const settings = useQuery(getFirebaseSettingsOptions())
  const [file, setFile] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [test, setTest] = useState<FirebaseTestResult | null>(null)

  const save = useMutation({
    ...saveFirebaseSettingsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getFirebaseSettingsQueryKey(), saved)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTenantApp' }] })
      setFile(null)
      setFileName('')
      setTest(null)
      toast.success(saved.set ? t('firebaseSaved') : t('firebaseCleared'))
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })
  const run = useMutation({
    ...testFirebaseMutation(),
    onSuccess: setTest,
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  if (!settings.data) return <Skeleton className='h-64 w-full' />
  const saved = settings.data

  return (
    <div className='space-y-6'>
      {!saved.set && (
        <Alert className='border-amber-500/40 bg-amber-500/10'>
          <AlertTitle>{t('firebaseNone')}</AlertTitle>
          <AlertDescription>{t('firebaseNoneHint')}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('firebaseAccount')}</CardTitle>
          <CardDescription>{t('firebaseAccountHint')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {saved.set && (
            <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>{t('firebaseServiceAccount')}</dt>
              <dd className='truncate font-mono' dir='ltr'>{saved.clientEmail}</dd>
              <dt className='text-muted-foreground'>{t('firebaseProject')}</dt>
              <dd className='font-mono' dir='ltr'>{saved.projectId}</dd>
              {saved.updatedAt && (
                <>
                  <dt className='text-muted-foreground'>{t('firebaseUpdated')}</dt>
                  <dd>{format.dateTime(saved.updatedAt)}</dd>
                </>
              )}
            </dl>
          )}
          <div className='space-y-2'>
            <Label htmlFor='firebase-key'>{saved.set ? t('firebaseReplace') : t('firebaseKeyFile')}</Label>
            <Input
              id='firebase-key'
              type='file'
              accept='application/json,.json'
              onChange={async (e) => {
                const picked = e.target.files?.[0]
                setFile(picked ? await readFileText(picked) : null)
                setFileName(picked?.name ?? '')
              }}
            />
            <p className='text-muted-foreground text-xs'>{t('firebaseKeyFileHint')}</p>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button disabled={!file || save.isPending} onClick={() => file && save.mutate({ body: { serviceAccountJson: file } })}>
              {save.isPending && <Spinner />}
              {t('save')}
              {fileName && <span className='text-xs opacity-70'>({fileName})</span>}
            </Button>
            {saved.set && (
              <>
                <Button variant='outline' disabled={run.isPending} onClick={() => run.mutate({})}>
                  {run.isPending && <Spinner />}
                  {t('firebaseTest')}
                </Button>
                <Button variant='ghost' disabled={save.isPending} onClick={() => save.mutate({ body: { clear: true } })}>
                  {t('firebaseClear')}
                </Button>
              </>
            )}
          </div>
          {test && (
            <div className='space-y-2 text-sm'>
              <p className={test.ok ? 'text-emerald-600' : 'text-destructive'}>{test.detail}</p>
              {test.apps.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {test.apps.map((app) => (
                    <Badge key={app} variant='outline' className='font-mono' dir='ltr'>
                      {app}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AppBuildsSettings />
    </div>
  )
}
