import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, X } from 'lucide-react'
import type { MapsKeyDto, MapsSettingsDto, MapsTestResult, SaveMapsSettingsRequest } from '@/api/control'
import {
  getMapsSettingsOptions,
  getMapsSettingsQueryKey,
  getPlatformOptions,
  saveMapsSettingsMutation,
  testMapsSearchMutation,
} from '@/api/control/@tanstack/react-query.gen'
import { useT, type TranslationKey } from '@/lib/i18n'
import { problemDetail } from '@/lib/problem'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

type KeyName = 'server' | 'browser' | 'android' | 'ios'

/** The four keys, in the order they are met, with what each is for and how Google Cloud should hold it */
const KEYS: { name: KeyName; label: TranslationKey; hint: TranslationKey }[] = [
  { name: 'server', label: 'mapsServerKey', hint: 'mapsServerKeyHint' },
  { name: 'browser', label: 'mapsBrowserKey', hint: 'mapsBrowserKeyHint' },
  { name: 'android', label: 'mapsAndroidKey', hint: 'mapsAndroidKeyHint' },
  { name: 'ios', label: 'mapsIosKey', hint: 'mapsIosKeyHint' },
]

/** What the form does with a key on save: keep it, put the typed one in its place, or take it off */
type KeyEdit = { mode: 'keep' } | { mode: 'replace'; value: string } | { mode: 'clear' }

const savedKey = (settings: MapsSettingsDto, name: KeyName): MapsKeyDto =>
  ({ server: settings.serverKey, browser: settings.browserKey, android: settings.androidKey, ios: settings.iosKey })[name]

/**
 * The platform's Google Maps: Ninja's one set of keys, the web map's switch
 * and the own domains the browser key lists. A business uses them only with
 * Google Maps on on its record; saving re-stamps those it reaches, and the
 * phone keys wait for each app's next build.
 */
export function MapsSettings() {
  const settings = useQuery(getMapsSettingsOptions())
  if (!settings.data) return <Skeleton className='h-96 w-full' />
  // A fresh form for every saved version: what is typed starts empty again
  return <MapsForm key={settings.data.updatedAt ?? 'new'} settings={settings.data} />
}

function MapsForm({ settings }: { settings: MapsSettingsDto }) {
  const t = useT()
  const queryClient = useQueryClient()
  const domain = useQuery(getPlatformOptions()).data?.domain ?? '{domain}'
  const [keys, setKeys] = useState<Record<KeyName, KeyEdit>>({
    server: { mode: 'keep' },
    browser: { mode: 'keep' },
    android: { mode: 'keep' },
    ios: { mode: 'keep' },
  })
  const [webTiles, setWebTiles] = useState(settings.webTiles)
  const [referrers, setReferrers] = useState<string[]>(settings.referrerDomains)
  const [typed, setTyped] = useState('')

  const save = useMutation({
    ...saveMapsSettingsMutation(),
    onSuccess: (saved) => {
      queryClient.setQueryData(getMapsSettingsQueryKey(), saved.settings)
      // Whether a business has keys to use, and which own domain to add, show on its page
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTenant' }] })
      setKeys({ server: { mode: 'keep' }, browser: { mode: 'keep' }, android: { mode: 'keep' }, ios: { mode: 'keep' } })
      setWebTiles(saved.settings.webTiles)
      setReferrers(saved.settings.referrerDomains)
      setTyped('')
      const restamping = saved.restamping.length
      const message = restamping > 0 ? t('mapsSavedRestamping', { count: restamping }) : t('mapsSaved')
      toast.success(saved.appKeysChanged ? `${message}. ${t('mapsSavedAppKeys')}` : message)
    },
    onError: (e) => toast.error(problemDetail(e) || t('somethingWentWrong')),
  })

  const keysChanged = Object.values(keys).some((k) => k.mode === 'clear' || (k.mode === 'replace' && k.value.trim() !== ''))
  const referrersChanged = referrers.join(',') !== settings.referrerDomains.join(',')
  const dirty = keysChanged || webTiles !== settings.webTiles || referrersChanged

  const addReferrer = () => {
    const entry = typed.trim()
    if (entry === '') return
    if (!referrers.includes(entry)) setReferrers([...referrers, entry])
    setTyped('')
  }

  const submit = () => {
    const value = (name: KeyName) => {
      const edit = keys[name]
      return edit.mode === 'replace' && edit.value.trim() !== '' ? edit.value.trim() : null
    }
    const body: SaveMapsSettingsRequest = {
      serverKey: value('server'),
      browserKey: value('browser'),
      androidKey: value('android'),
      iosKey: value('ios'),
      clearServerKey: keys.server.mode === 'clear',
      clearBrowserKey: keys.browser.mode === 'clear',
      clearAndroidKey: keys.android.mode === 'clear',
      clearIosKey: keys.ios.mode === 'clear',
      webTiles,
      // Something typed but not added yet goes in too, as it would be expected to
      referrerDomains: typed.trim() !== '' && !referrers.includes(typed.trim()) ? [...referrers, typed.trim()] : referrers,
    }
    save.mutate({ body })
  }

  return (
    <form
      className='space-y-6'
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      {!settings.serverKey.set && (
        <Alert className='border-amber-500/40 bg-amber-500/10'>
          <AlertTitle>{t('mapsNoServerKey')}</AlertTitle>
          <AlertDescription>{t('mapsNoServerKeyHint')}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('mapsKeys')}</CardTitle>
          <CardDescription>{t('mapsKeysHint', { count: Number(settings.businessesOn) })}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {KEYS.map(({ name, label, hint }) => (
            <KeyRow
              key={name}
              id={`maps-${name}`}
              label={t(label)}
              hint={t(hint, { domain })}
              saved={savedKey(settings, name)}
              edit={keys[name]}
              onChange={(edit) => setKeys({ ...keys, [name]: edit })}
            />
          ))}
          <p className='text-muted-foreground border-s-2 ps-3 text-xs'>{t('mapsAppKeysRebuild')}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('mapsWebTiles')}</CardTitle>
          <CardDescription>{t('mapsWebTilesHint')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          <div className='flex items-center gap-3'>
            <Switch id='maps-web-tiles' checked={webTiles} onCheckedChange={setWebTiles} />
            <Label htmlFor='maps-web-tiles'>{t('mapsWebTiles')}</Label>
          </div>

          <div className='space-y-2'>
            <div className='text-sm font-medium'>{t('mapsReferrers')}</div>
            <p className='text-muted-foreground text-xs'>{t('mapsReferrersHint')}</p>
            {referrers.length === 0 ? (
              <p className='text-muted-foreground text-sm'>{t('mapsReferrersNone')}</p>
            ) : (
              <div className='flex flex-wrap gap-2'>
                {referrers.map((referrer) => (
                  <Badge key={referrer} variant='outline' className='gap-1 py-1 ps-2.5 pe-1 font-mono'>
                    <span dir='ltr'>{referrer}</span>
                    <button
                      type='button'
                      className='hover:bg-muted rounded-sm p-0.5'
                      onClick={() => setReferrers(referrers.filter((r) => r !== referrer))}
                      aria-label={t('mapsReferrerRemove', { domain: referrer })}
                    >
                      <X className='size-3.5' />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className='flex max-w-md gap-2'>
              <Input
                dir='ltr'
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addReferrer()
                  }
                }}
                placeholder={t('mapsReferrerPlaceholder')}
                aria-label={t('mapsReferrers')}
              />
              <Button type='button' variant='outline' onClick={addReferrer} disabled={typed.trim() === ''}>
                <Plus />
                {t('mapsReferrerAdd')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex items-center justify-end gap-3'>
        {dirty && <span className='text-muted-foreground text-sm'>{t('mapsUnsaved')}</span>}
        <Button type='submit' disabled={!dirty || save.isPending}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </div>

      <TestCard ready={settings.serverKey.set} />
    </form>
  )
}

/** One key: its last four once saved, with Replace and Clear; an empty box to paste one into until then. */
function KeyRow({
  id,
  label,
  hint,
  saved,
  edit,
  onChange,
}: {
  id: string
  label: string
  hint: string
  saved: MapsKeyDto
  edit: KeyEdit
  onChange: (edit: KeyEdit) => void
}) {
  const t = useT()
  const typing = !saved.set || edit.mode === 'replace'
  return (
    <div className='grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-start'>
      <Label htmlFor={typing ? id : undefined} className='pt-2'>
        {label}
      </Label>
      <div className='space-y-1.5'>
        <div className='flex flex-wrap items-center gap-2'>
          {saved.set && (
            <Badge variant='outline' className={cn('font-mono', edit.mode === 'clear' && 'line-through opacity-60')}>
              ••••{saved.hint}
            </Badge>
          )}
          {!saved.set && edit.mode !== 'replace' && <Badge variant='secondary'>{t('mapsKeyNotSet')}</Badge>}
          {typing && (
            <Input
              id={id}
              type='password'
              dir='ltr'
              autoComplete='off'
              className='min-w-0 flex-1 sm:max-w-sm'
              value={edit.mode === 'replace' ? edit.value : ''}
              onChange={(e) => onChange({ mode: 'replace', value: e.target.value })}
              placeholder={saved.set ? t('mapsKeyKeepHint', { hint: saved.hint }) : t('mapsKeyPaste')}
            />
          )}
          {saved.set && edit.mode === 'keep' && (
            <>
              <Button type='button' variant='outline' size='sm' onClick={() => onChange({ mode: 'replace', value: '' })}>
                {t('mapsKeyReplace')}
              </Button>
              <Button type='button' variant='ghost' size='sm' className='text-destructive' onClick={() => onChange({ mode: 'clear' })}>
                {t('mapsKeyClear')}
              </Button>
            </>
          )}
          {saved.set && edit.mode !== 'keep' && (
            <Button type='button' variant='ghost' size='sm' onClick={() => onChange({ mode: 'keep' })}>
              {t('mapsKeyKeep')}
            </Button>
          )}
          {edit.mode === 'clear' && <span className='text-destructive text-xs'>{t('mapsKeyWillClear')}</span>}
        </div>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </div>
    </div>
  )
}

/** One search through the saved server key, straight to Google: whether it answers from this box, and how fast. */
function TestCard({ ready }: { ready: boolean }) {
  const t = useT()
  const test = useMutation(testMapsSearchMutation())
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('mapsTest')}</CardTitle>
        <CardDescription>{t('mapsTestHint')}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-2'>
        <Button type='button' variant='outline' disabled={!ready || test.isPending} onClick={() => test.mutate({})}>
          {test.isPending ? <Spinner /> : <Search />}
          {t('mapsTest')}
        </Button>
        {!ready && <p className='text-muted-foreground text-xs'>{t('mapsTestSaveFirst')}</p>}
        {test.data && <TestLine result={test.data} />}
        {test.isError && <p className='text-destructive text-xs'>{problemDetail(test.error) || t('somethingWentWrong')}</p>}
      </CardContent>
    </Card>
  )
}

function TestLine({ result }: { result: MapsTestResult }) {
  const t = useT()
  return (
    <p className={cn('text-xs', result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {result.ok
        ? t('mapsTestOk', { count: Number(result.suggestions), ms: String(result.milliseconds), first: result.first ?? '' })
        : t('mapsTestFailed', { error: result.error ?? '' })}
    </p>
  )
}
