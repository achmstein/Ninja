import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Send } from 'lucide-react'
import {
  getTalabatOptions,
  getTalabatQueryKey,
  previewTalabatMenuOptions,
  pushTalabatMenuMutation,
  saveTalabatMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import type { TalabatStatusView } from '@/api/catalog/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'

const talabatQuery = { query: { 'api-version': API_VERSION } }
const logo = `${import.meta.env.BASE_URL}platforms/talabat.svg`

const REFUSAL_KINDS: Record<string, TranslationKey> = {
  Menu: 'talabatRefusalMenu',
  Availability: 'talabatRefusalAvailability',
  Store: 'talabatRefusalStore',
}

/**
 * Talabat, the owner's side: which branches sell there, whether pausing a
 * branch here closes it there, how the last menu went and sending it now.
 * Ninja's connection and the café's chain at Talabat are the platform's to
 * set; until they are, the page says so and still keeps the owner's choices.
 */
export function TalabatSettingsPage() {
  const t = useT()
  const query = useQuery({ ...getTalabatOptions(talabatQuery), refetchInterval: 15_000 })
  const status = query.data

  return (
    <Main>
      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <PageHeader
          title={
            <span className='flex items-center gap-3'>
              <img src={logo} alt={t('talabatNav')} className='h-6 w-auto' />
            </span>
          }
          description={t('talabatDescription')}
          badge={
            status &&
            (status.connected ? (
              <Badge className='bg-emerald-600 text-white hover:bg-emerald-600'>
                {t('talabatConnected')}
              </Badge>
            ) : (
              <Badge variant='outline'>{t('talabatNotConnected')}</Badge>
            ))
          }
        />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : status ? (
          <TalabatSettings status={status} />
        ) : (
          <Skeleton className='h-[32rem] w-full' />
        )}
      </div>
    </Main>
  )
}

function TalabatSettings({ status }: { status: TalabatStatusView }) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const queryClient = useQueryClient()
  const { branches, isLoading: branchesLoading } = useAllowedBranches()
  const onTalabat = status.branchIds.map(Number)

  const save = useMutation({
    ...saveTalabatMutation(),
    onSuccess: (data) => {
      queryClient.setQueryData(getTalabatQueryKey(talabatQuery), data)
      toast.success(t('talabatSaved'))
    },
    onError: () => toast.error(t('talabatSaveFailed')),
  })

  const push = useMutation({ ...pushTalabatMenuMutation() })
  const [sending, setSending] = useState(false)

  const saveWith = (branchIds: number[], syncOpenClose: boolean) =>
    save.mutate({ ...talabatQuery, body: { branchIds, syncOpenClose } })

  const toggleBranch = (id: number, on: boolean) =>
    saveWith(
      on ? [...onTalabat, id] : onTalabat.filter((b) => b !== id),
      status.syncOpenClose
    )

  // The api client stamps the current branch on every call, so each branch
  // on Talabat is sent by name: the owner means all of them
  const sendNow = async () => {
    setSending(true)
    try {
      for (const id of onTalabat) {
        await push.mutateAsync({
          ...talabatQuery,
          headers: { 'X-Branch-Id': String(id) },
        })
      }
      toast.success(t('talabatSendQueued'))
      await queryClient.invalidateQueries({ queryKey: getTalabatQueryKey(talabatQuery) })
    } catch {
      toast.error(t('talabatSendFailed'))
    } finally {
      setSending(false)
    }
  }

  const when = (value?: string | null) =>
    value ? new Date(value).toLocaleString(locale) : null
  const pending = Number(status.pending ?? 0)
  const changedSinceSent =
    status.menuChangedAt &&
    (!status.menuSentAt || new Date(status.menuChangedAt) > new Date(status.menuSentAt))

  return (
    <div className='space-y-6'>
      {!status.connected && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t('talabatNotConnectedTitle')}</AlertTitle>
          <AlertDescription>{t('talabatNotConnectedBody')}</AlertDescription>
        </Alert>
      )}

      {/* Where the café sells on Talabat */}
      <Card>
        <CardContent className='space-y-4 pt-6'>
          <div className='space-y-1'>
            <h2 className='font-semibold'>{t('talabatBranches')}</h2>
            <p className='text-muted-foreground text-xs'>{t('talabatBranchesHint')}</p>
          </div>
          {branchesLoading ? (
            <Skeleton className='h-20 w-full' />
          ) : (
            <div className='divide-y rounded-lg border'>
              {branches.map((branch) => {
                const id = Number(branch.id)
                return (
                  <div key={id} className='flex items-center justify-between p-3'>
                    <Label htmlFor={`talabat-branch-${id}`} className='text-sm'>
                      {localized(branch.name)}
                    </Label>
                    <Switch
                      id={`talabat-branch-${id}`}
                      checked={onTalabat.includes(id)}
                      disabled={save.isPending}
                      onCheckedChange={(on) => toggleBranch(id, on)}
                    />
                  </div>
                )
              })}
            </div>
          )}
          <div className='flex items-start justify-between gap-4 rounded-lg border p-3'>
            <div className='space-y-1'>
              <Label htmlFor='talabat-sync-open-close' className='text-sm'>
                {t('talabatSyncOpenClose')}
              </Label>
              <p className='text-muted-foreground text-xs'>{t('talabatSyncOpenCloseHint')}</p>
            </div>
            <Switch
              id='talabat-sync-open-close'
              checked={status.syncOpenClose}
              disabled={save.isPending}
              onCheckedChange={(on) => saveWith(onTalabat, on)}
            />
          </div>
        </CardContent>
      </Card>

      {/* The menu Talabat shows */}
      <Card>
        <CardContent className='space-y-4 pt-6'>
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-1'>
              <h2 className='font-semibold'>{t('talabatMenu')}</h2>
              <p className='text-muted-foreground text-xs'>{t('talabatMenuHint')}</p>
            </div>
            <Button
              type='button'
              variant='outline'
              disabled={sending || onTalabat.length === 0 || !status.connected}
              onClick={sendNow}
            >
              <Send className='size-4' />
              {t('talabatSendNow')}
            </Button>
          </div>
          <div className='space-y-1 text-sm'>
            <p>
              {status.menuSentAt
                ? t('talabatMenuSent', { time: when(status.menuSentAt)! })
                : t('talabatMenuNeverSent')}
            </p>
            {status.lastMenuResult && (
              <p className='text-muted-foreground'>
                {t('talabatMenuResult', { result: status.lastMenuResult })}
              </p>
            )}
            {changedSinceSent && onTalabat.length > 0 && (
              <p className='text-muted-foreground'>{t('talabatMenuWaiting')}</p>
            )}
            {pending > 0 && (
              <p className='text-muted-foreground'>{t('talabatPending', { count: pending })}</p>
            )}
          </div>
          {onTalabat[0] != null && <MenuPreview branchId={onTalabat[0]} />}
        </CardContent>
      </Card>

      {/* What Talabat turned down */}
      {status.failed.length > 0 && (
        <Card>
          <CardContent className='space-y-3 pt-6'>
            <h2 className='font-semibold'>{t('talabatRefusals')}</h2>
            <div className='divide-y rounded-lg border text-sm'>
              {status.failed.map((f, i) => {
                const kind = REFUSAL_KINDS[f.kind]
                const branch = branches.find((b) => Number(b.id) === Number(f.branchId))
                return (
                  <div key={i} className='space-y-0.5 p-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>{kind ? t(kind) : f.kind}</Badge>
                      {branch && <span>{localized(branch.name)}</span>}
                      {f.code && (
                        <span className='text-muted-foreground font-mono text-xs' dir='ltr'>
                          {f.code}
                        </span>
                      )}
                      <span className='text-muted-foreground ms-auto text-xs'>{when(f.at)}</span>
                    </div>
                    {f.error && (
                      <p className='text-muted-foreground break-all font-mono text-xs' dir='ltr'>
                        {f.error}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

type CatalogItem = { type?: string }

/** How much of the menu Talabat is sent, and the raw catalog on demand. */
function MenuPreview({ branchId }: { branchId: number }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const preview = useQuery(
    previewTalabatMenuOptions({ ...talabatQuery, path: { branchId } })
  )
  const items = (preview.data as { items?: Record<string, CatalogItem> } | undefined)?.items
  if (!items) return null

  const all = Object.entries(items)
  const dishes = all.filter(([id]) => id.startsWith('item-')).length
  const options = all.filter(([id]) => id.startsWith('option-')).length
  const categories = all.filter(([, item]) => item.type === 'Category').length

  return (
    <div className='space-y-2 rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-sm'>
          <span className='font-medium'>{t('talabatPreview')}</span>
          <span className='text-muted-foreground'>
            {' · '}
            {t('talabatPreviewCounts', { dishes, options, categories })}
          </span>
        </div>
        <Button type='button' variant='ghost' size='sm' onClick={() => setOpen((v) => !v)}>
          {open ? t('talabatPreviewHide') : t('talabatPreviewShow')}
          <ChevronDown className={open ? 'size-4 rotate-180' : 'size-4'} />
        </Button>
      </div>
      {open && (
        <pre dir='ltr' className='bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs'>
          {JSON.stringify(preview.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
