import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Circle, KeyRound, ShieldCheck, Smartphone, Sparkles, XCircle } from 'lucide-react'
import type { AppCheck, TenantAppStatus, TenantDetail } from '@/api/control'
import {
  checkTenantAppMutation,
  generateAndroidKeyMutation,
  getTenantAppOptions,
  getTenantAppQueryKey,
  importAndroidKeyMutation,
  linkFirebaseAppsMutation,
  setAppIconsFromBrandMutation,
  setAppIconsMutation,
  setAppleKeyMutation,
  setAppGoogleSignInMutation,
  setPlayKeyMutation,
  setUpTenantAppMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { apiClient } from '@/lib/api-client'
import { readFileBase64, readFileText } from '@/lib/files'
import { useFormat } from '@/lib/format'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
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
import { CopyButton } from '@/components/copy-button'
import { AppBuildCard } from '../app-build'
import { GiveOwnApp, OwnAppRecord } from './app-record'

const CHECK_LABELS: Record<string, TranslationKey> = {
  'android-key': 'appAndroidKey',
  play: 'appPlay',
  apple: 'appApple',
  'firebase-android': 'appFirebaseAndroid',
  'firebase-ios': 'appFirebaseIos',
  icon: 'appIcons',
  'apple-team': 'appleTeamId',
  'app-links': 'androidFingerprints',
  'google-sign-in': 'appGoogleSignIn',
}

/**
 * A business's own customer app: what its builds sign and upload with, kept
 * here so nothing is set per business in GitHub. One card per thing to give,
 * each saying whether it is there; Check all tries the keys from the server.
 * A key is never shown again, only that it is set.
 */
export function AppTab({ tenant }: { tenant: TenantDetail }) {
  const path = { slug: tenant.slug }
  const app = useQuery({ ...getTenantAppOptions({ path }), enabled: !!tenant.appId })

  if (!tenant.appId) return <GiveOwnApp tenant={tenant} />
  if (!app.data) return <Skeleton className='h-96 w-full' />
  return <AppCards tenant={tenant} app={app.data} />
}

function AppCards({ tenant, app }: { tenant: TenantDetail; app: TenantAppStatus }) {
  const t = useT()
  const format = useFormat()
  const queryClient = useQueryClient()
  const path = { slug: tenant.slug }

  const onSaved = (status: TenantAppStatus, message: string) => {
    queryClient.setQueryData(getTenantAppQueryKey({ path }), status)
    // The upload key's fingerprint joins the record's
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getTenant' }] })
    toast.success(message)
  }
  const onError = (e: unknown) => toast.error(problemDetail(e) || t('somethingWentWrong'))

  const check = useMutation({ ...checkTenantAppMutation(), onSuccess: (s) => onSaved(s, t('appChecked')), onError })
  const setup = useMutation({
    ...setUpTenantAppMutation(),
    onSuccess: (r) => {
      queryClient.setQueryData(getTenantAppQueryKey({ path }), r.app)
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTenant' }] })
      const failed = r.steps.filter((s) => !s.ok)
      if (failed.length === 0) toast.success(t('appSetUpDone'))
      else toast.warning(failed.map((s) => s.detail).join(' · '))
    },
    onError,
  })
  const firebase = useMutation({
    ...linkFirebaseAppsMutation(),
    onSuccess: (r) => onSaved(r.app, r.done.join(' · ')),
    onError,
  })

  const done = [
    app.androidKey.set,
    app.play.set,
    app.apple.set,
    app.icons.icon,
    app.firebase.androidFile && app.firebase.iosFile,
  ]
  const ready = done.filter(Boolean).length

  return (
    <div className='flex flex-col gap-4'>
      <Card>
        <CardHeader className='flex flex-row flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1.5'>
            <CardTitle className='flex items-center gap-2'>
              <Smartphone className='size-4' />
              <span dir='ltr'>{tenant.appId}</span>
            </CardTitle>
            <CardDescription>{t('appReady', { done: ready, total: done.length })}</CardDescription>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button disabled={setup.isPending} onClick={() => setup.mutate({ path })}>
              {setup.isPending ? <Spinner /> : <Sparkles />}
              {t('appSetUp')}
            </Button>
            <Button
              variant='outline'
              disabled={check.isPending || setup.isPending}
              onClick={() => check.mutate({ path })}
            >
              {check.isPending ? <Spinner /> : <ShieldCheck />}
              {t('appCheckAll')}
            </Button>
          </div>
        </CardHeader>
        {app.checks.length > 0 && (
          <CardContent className='space-y-2'>
            {app.checks.map((c) => (
              <CheckLine key={c.item} check={c} />
            ))}
            {app.checkedAt && (
              <p className='text-muted-foreground pt-1 text-xs'>
                {t('appCheckedAt', { when: format.dateTime(app.checkedAt) })}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      <AppBuildCard slug={tenant.slug} />
      <OwnAppRecord
        key={`${tenant.appId}-${tenant.appleTeamId}-${(tenant.androidCertFingerprints ?? []).join(',')}`}
        tenant={tenant}
        uploadSha256={app.androidKey.sha256}
      />

      {/* Two columns that stack each on its own, so a short card never leaves a gap beside a tall one */}
      <div className='grid items-start gap-4 lg:grid-cols-2'>
        <div className='flex flex-col gap-4'>
          <AndroidKeyCard tenant={tenant} app={app} onSaved={onSaved} onError={onError} />
          <AppleCard tenant={tenant} app={app} onSaved={onSaved} onError={onError} />
          <Item
            title={t('appFirebase')}
            set={app.firebase.androidFile && app.firebase.iosFile}
            hint={app.firebase.platformReady ? t('appFirebaseHint') : t('appFirebaseNoAccount')}
          >
            {(app.firebase.androidAppId || app.firebase.iosAppId) && (
              <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs'>
                <dt className='text-muted-foreground'>Android</dt>
                <dd className='truncate font-mono' dir='ltr'>
                  {app.firebase.androidAppId ?? '—'}
                </dd>
                <dt className='text-muted-foreground'>iOS</dt>
                <dd className='truncate font-mono' dir='ltr'>
                  {app.firebase.iosAppId ?? '—'}
                </dd>
              </dl>
            )}
            <Button
              size='sm'
              variant={app.firebase.androidFile ? 'outline' : 'default'}
              disabled={!app.firebase.platformReady || firebase.isPending}
              onClick={() => firebase.mutate({ path })}
            >
              {firebase.isPending && <Spinner />}
              {app.firebase.androidFile ? t('appFirebaseAgain') : t('appFirebaseLink')}
            </Button>
          </Item>
        </div>
        <div className='flex flex-col gap-4'>
          <PlayCard tenant={tenant} app={app} onSaved={onSaved} onError={onError} />
          <IconsCard tenant={tenant} app={app} onSaved={onSaved} onError={onError} />
          {app.googleSignIn.project && (
            <GoogleSignInCard
              key={`${app.googleSignIn.iosClientId}-${app.googleSignIn.playSigningSha1}`}
              tenant={tenant}
              app={app}
              onSaved={onSaved}
              onError={onError}
            />
          )}
        </div>
      </div>
    </div>
  )
}

type CardProps = {
  tenant: TenantDetail
  app: TenantAppStatus
  onSaved: (status: TenantAppStatus, message: string) => void
  onError: (e: unknown) => void
}

function AndroidKeyCard({ tenant, app, onSaved, onError }: CardProps) {
  const t = useT()
  const path = { slug: tenant.slug }
  const [importing, setImporting] = useState(false)
  const [confirm, setConfirm] = useState<'generate' | 'import' | null>(null)
  const [file, setFile] = useState<string | null>(null)
  const [alias, setAlias] = useState('upload')
  const [storePassword, setStorePassword] = useState('')
  const [keyPassword, setKeyPassword] = useState('')

  const generate = useMutation({
    ...generateAndroidKeyMutation(),
    onSuccess: (s) => onSaved(s, t('appAndroidKeyMade')),
    onError,
  })
  const take = useMutation({
    ...importAndroidKeyMutation(),
    onSuccess: (s) => {
      setImporting(false)
      setFile(null)
      setStorePassword('')
      setKeyPassword('')
      onSaved(s, t('appAndroidKeyImported'))
    },
    onError,
  })
  const doImport = (replace: boolean) =>
    file &&
    take.mutate({
      path,
      body: { keystore: file, alias, storePassword, keyPassword: keyPassword || null, confirm: replace },
    })

  const key = app.androidKey
  return (
    <Item
      title={t('appAndroidKey')}
      set={key.set}
      hint={
        key.set
          ? key.format === 'jks'
            ? t('appAndroidKeyJks')
            : t('appAndroidKeySet', { alias: key.alias ?? '' })
          : t('appAndroidKeyHint')
      }
    >
      {key.sha256 && <Fingerprint label='SHA-256' value={key.sha256} />}
      {key.sha1 && <Fingerprint label='SHA-1' value={key.sha1} />}
      {importing ? (
        <div className='space-y-3'>
          <Input
            type='file'
            accept='.jks,.keystore,.p12,.pfx'
            onChange={async (e) => setFile(e.target.files?.[0] ? await readFileBase64(e.target.files[0]) : null)}
          />
          <div className='grid gap-2 sm:grid-cols-3'>
            <Field id='key-alias' label={t('appKeyAlias')} value={alias} onChange={setAlias} />
            <Field
              id='key-store'
              label={t('appStorePassword')}
              value={storePassword}
              onChange={setStorePassword}
              secret
            />
            <Field
              id='key-pass'
              label={t('appKeyPassword')}
              value={keyPassword}
              onChange={setKeyPassword}
              secret
              placeholder={t('appKeyPasswordSame')}
            />
          </div>
          <div className='flex gap-2'>
            <Button
              size='sm'
              disabled={!file || !storePassword || take.isPending}
              onClick={() => (key.set ? setConfirm('import') : doImport(false))}
            >
              {take.isPending && <Spinner />}
              {t('appImport')}
            </Button>
            <Button size='sm' variant='ghost' onClick={() => setImporting(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          <Button
            size='sm'
            variant={key.set ? 'outline' : 'default'}
            disabled={generate.isPending}
            onClick={() => (key.set ? setConfirm('generate') : generate.mutate({ path, body: {} }))}
          >
            {generate.isPending ? <Spinner /> : <KeyRound />}
            {t('appGenerate')}
          </Button>
          <Button size='sm' variant='outline' onClick={() => setImporting(true)}>
            {t('appImportExisting')}
          </Button>
        </div>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('appReplaceKeyTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('appReplaceKeyHint')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === 'generate') generate.mutate({ path, body: { confirm: true } })
                else doImport(true)
                setConfirm(null)
              }}
            >
              {t('appReplaceKey')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Item>
  )
}

/**
 * Google sign-in in the app: Google answers only an app whose own clients are
 * in the platform sign-in client's Google Cloud project. Android's is made by
 * Firebase once it has the SHA-1 of the key Play signs with; iOS's is made by
 * hand there and its id given here.
 */
function GoogleSignInCard({ tenant, app, onSaved, onError }: CardProps) {
  const t = useT()
  const google = app.googleSignIn
  const [ios, setIos] = useState(google.iosClientGiven ? (google.iosClientId ?? '') : '')
  const [playSha1, setPlaySha1] = useState(google.playSigningSha1 ?? '')
  const save = useMutation({
    ...setAppGoogleSignInMutation(),
    onSuccess: (s) => onSaved(s, t('appGoogleSignInSaved')),
    onError,
  })
  const dirty =
    ios.trim() !== (google.iosClientGiven ? (google.iosClientId ?? '') : '') ||
    playSha1.trim() !== (google.playSigningSha1 ?? '')
  return (
    <Item
      title={t('appGoogleSignIn')}
      set={google.iosClientInProject && !!google.playSigningSha1}
      hint={t('appGoogleSignInHint', { project: google.project ?? '' })}
    >
      <div className='space-y-1'>
        <Field
          id='google-play-sha1'
          label={t('appPlaySigningSha1')}
          value={playSha1}
          onChange={setPlaySha1}
          placeholder='AA:BB:…'
        />
        <p className='text-muted-foreground text-xs'>{t('appPlaySigningSha1Hint')}</p>
      </div>
      <div className='space-y-1'>
        <Field
          id='google-ios'
          label={t('appGoogleIosClient')}
          value={ios}
          onChange={setIos}
          placeholder={google.iosClientId ?? `${google.project}-….apps.googleusercontent.com`}
        />
        <p className={cn('text-xs', google.iosClientInProject ? 'text-muted-foreground' : 'text-destructive')}>
          {google.iosClientInProject
            ? t('appGoogleIosClientOk')
            : t('appGoogleIosClientHint', { project: google.project ?? '', bundle: tenant.appId ?? '' })}
        </p>
      </div>
      <Button
        size='sm'
        disabled={!dirty || save.isPending}
        onClick={() =>
          save.mutate({
            path: { slug: tenant.slug },
            body: { iosClientId: ios.trim() || null, playSigningSha1: playSha1.trim() || null },
          })
        }
      >
        {save.isPending && <Spinner />}
        {t('save')}
      </Button>
    </Item>
  )
}

function PlayCard({ tenant, app, onSaved, onError }: CardProps) {
  const t = useT()
  const save = useMutation({ ...setPlayKeyMutation(), onSuccess: (s) => onSaved(s, t('appPlaySaved')), onError })
  return (
    <Item
      title={t('appPlay')}
      set={app.play.set}
      hint={app.play.clientEmail ?? t('appPlayHint')}
      mono={!!app.play.clientEmail}
    >
      <FilePick
        id='play-key'
        accept='application/json,.json'
        label={app.play.set ? t('appReplaceFile') : t('appPlayFile')}
        busy={save.isPending}
        onPick={async (f) =>
          save.mutate({ path: { slug: tenant.slug }, body: { serviceAccountJson: await readFileText(f) } })
        }
      />
    </Item>
  )
}

function AppleCard({ tenant, app, onSaved, onError }: CardProps) {
  const t = useT()
  const [keyId, setKeyId] = useState(app.apple.keyId ?? '')
  const [issuerId, setIssuerId] = useState(app.apple.issuerId ?? '')
  const [p8, setP8] = useState<string | null>(null)
  const save = useMutation({
    ...setAppleKeyMutation(),
    onSuccess: (s) => {
      setP8(null)
      onSaved(s, t('appAppleSaved'))
    },
    onError,
  })
  return (
    <Item
      title={t('appApple')}
      set={app.apple.set}
      hint={app.apple.set ? t('appAppleSet', { keyId: app.apple.keyId ?? '' }) : t('appAppleHint')}
    >
      <div className='grid gap-2 sm:grid-cols-2'>
        <Field id='asc-key' label={t('appAppleKeyId')} value={keyId} onChange={setKeyId} />
        <Field id='asc-issuer' label={t('appAppleIssuerId')} value={issuerId} onChange={setIssuerId} />
      </div>
      <Input
        type='file'
        accept='.p8'
        aria-label={t('appAppleP8')}
        onChange={async (e) => setP8(e.target.files?.[0] ? await readFileText(e.target.files[0]) : null)}
      />
      <Button
        size='sm'
        disabled={!p8 || !keyId.trim() || !issuerId.trim() || save.isPending}
        onClick={() => p8 && save.mutate({ path: { slug: tenant.slug }, body: { keyId, issuerId, privateKey: p8 } })}
      >
        {save.isPending && <Spinner />}
        {t('save')}
      </Button>
    </Item>
  )
}

function IconsCard({ tenant, app, onSaved, onError }: CardProps) {
  const t = useT()
  const path = { slug: tenant.slug }
  const save = useMutation({ ...setAppIconsMutation(), onSuccess: (s) => onSaved(s, t('appIconsSaved')), onError })
  const brand = useMutation({
    ...setAppIconsFromBrandMutation(),
    onSuccess: (s) => onSaved(s, t('appIconsFromBrandDone')),
    onError,
  })
  const busy = save.isPending || brand.isPending
  return (
    <Item title={t('appIcons')} set={app.icons.icon} hint={t('appIconsHint')}>
      <Button
        size='sm'
        variant={app.icons.icon ? 'outline' : 'default'}
        disabled={busy}
        onClick={() => brand.mutate({ path })}
      >
        {brand.isPending && <Spinner />}
        {t('appIconsFromBrand')}
      </Button>
      <div className='flex flex-wrap items-start gap-4'>
        <IconPick
          slug={tenant.slug}
          which='icon'
          label={t('appIcon')}
          set={app.icons.icon}
          busy={busy}
          onPick={async (f) => save.mutate({ path, body: { icon: await readFileBase64(f) } })}
        />
        <IconPick
          slug={tenant.slug}
          which='foreground'
          label={t('appIconForeground')}
          set={app.icons.foreground}
          busy={busy}
          onPick={async (f) => save.mutate({ path, body: { foreground: await readFileBase64(f) } })}
        />
      </div>
    </Item>
  )
}

/** A saved icon, fetched with the bearer token like the app config download, and a picker for a new one */
function IconPick({
  slug,
  which,
  label,
  set,
  busy,
  onPick,
}: {
  slug: string
  which: 'icon' | 'foreground'
  label: string
  set: boolean
  busy: boolean
  onPick: (f: File) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  useEffect(() => {
    if (!set) return
    let revoke: string | null = null
    apiClient
      .get<Blob>(`/api/control/tenants/${encodeURIComponent(slug)}/app/icons/${which}`, { responseType: 'blob' })
      .then((res) => {
        revoke = URL.createObjectURL(res.data)
        setUrl(revoke)
      })
      .catch(() => setUrl(null))
    return () => {
      if (revoke) URL.revokeObjectURL(revoke)
    }
  }, [slug, which, set, version])

  return (
    <label className='flex cursor-pointer flex-col items-center gap-1.5'>
      <span
        className={cn(
          'bg-muted flex size-20 items-center justify-center overflow-hidden rounded-2xl border',
          busy && 'opacity-50'
        )}
      >
        {set && url ? (
          <img src={url} alt='' className='size-full object-cover' />
        ) : (
          <Smartphone className='text-muted-foreground size-6' />
        )}
      </span>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <input
        type='file'
        accept='image/png'
        className='sr-only'
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) {
            onPick(f)
            setVersion((v) => v + 1)
          }
          e.target.value = ''
        }}
      />
    </label>
  )
}

function Item({
  title,
  set,
  hint,
  mono,
  children,
}: {
  title: string
  set: boolean
  hint: string
  mono?: boolean
  children: ReactNode
}) {
  return (
    <Card className='gap-4'>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-sm'>
          {set ? (
            <CheckCircle2 className='size-4 text-emerald-600' />
          ) : (
            <Circle className='text-muted-foreground size-4' />
          )}
          {title}
        </CardTitle>
        <CardDescription className={cn('break-words', mono && 'font-mono text-xs')} dir={mono ? 'ltr' : undefined}>
          {hint}
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-3'>{children}</CardContent>
    </Card>
  )
}

function CheckLine({ check }: { check: AppCheck }) {
  const t = useT()
  const label = CHECK_LABELS[check.item]
  return (
    <div className='flex items-start gap-2 text-sm'>
      {check.ok ? (
        <CheckCircle2 className='mt-0.5 size-4 shrink-0 text-emerald-600' />
      ) : (
        <XCircle className='text-destructive mt-0.5 size-4 shrink-0' />
      )}
      <span className='font-medium'>{label ? t(label) : check.item}</span>
      <span className='text-muted-foreground min-w-0 break-words'>{check.detail}</span>
    </div>
  )
}

function Fingerprint({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-center gap-2 text-xs'>
      <span className='text-muted-foreground w-14 shrink-0'>{label}</span>
      <span className='min-w-0 truncate font-mono' dir='ltr'>
        {value}
      </span>
      <CopyButton value={value} />
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  secret,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  secret?: boolean
  placeholder?: string
}) {
  return (
    <div className='space-y-1'>
      <Label htmlFor={id} className='text-xs'>
        {label}
      </Label>
      <Input
        id={id}
        dir='ltr'
        type={secret ? 'password' : 'text'}
        autoComplete='off'
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function FilePick({
  id,
  accept,
  label,
  busy,
  onPick,
}: {
  id: string
  accept: string
  label: string
  busy: boolean
  onPick: (f: File) => void
}) {
  return (
    <div className='space-y-1'>
      <Label htmlFor={id} className='text-xs'>
        {label}
      </Label>
      <div className='flex items-center gap-2'>
        <Input
          id={id}
          type='file'
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPick(f)
            e.target.value = ''
          }}
        />
        {busy && <Spinner />}
      </div>
    </div>
  )
}
