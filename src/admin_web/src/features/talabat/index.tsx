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
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/error-state'
import { SettingRow, SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'

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
 * Ninja's connection and the business's chain at Talabat are the platform's to
 * set; until they are, the page says so and still keeps the owner's choices.
 */
export function TalabatSettingsPage() {
  const t = useT()
  const query = useQuery({
    ...getTalabatOptions(talabatQuery),
    refetchInterval: 15_000,
  })
  const status = query.data

  return (
    <Main>
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
            <StatusChip tone='success'>{t('talabatConnected')}</StatusChip>
          ) : (
            <StatusChip tone='warning'>{t('talabatNotConnected')}</StatusChip>
          ))
        }
      />
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : status ? (
        <TalabatSettings status={status} />
      ) : (
        <Skeleton className='h-[32rem] w-full rounded-xl' />
      )}
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
      await queryClient.invalidateQueries({
        queryKey: getTalabatQueryKey(talabatQuery),
      })
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
    (!status.menuSentAt ||
      new Date(status.menuChangedAt) > new Date(status.menuSentAt))
  const waiting = Boolean(changedSinceSent) && onTalabat.length > 0
  const menuNotes = status.lastMenuResult || waiting || pending > 0

  return (
    <div className='space-y-6'>
      {!status.connected && (
        <Alert>
          <AlertTriangle />
          <AlertTitle>{t('talabatNotConnectedTitle')}</AlertTitle>
          <AlertDescription>{t('talabatNotConnectedBody')}</AlertDescription>
        </Alert>
      )}

      {/* Where the business sells on Talabat */}
      <SettingsCard
        title={t('talabatBranches')}
        description={t('talabatBranchesHint')}
      >
        {branchesLoading ? (
          <div className='px-5 py-4'>
            <Skeleton className='h-20 w-full' />
          </div>
        ) : (
          branches.map((branch) => {
            const id = Number(branch.id)
            return (
              <SettingRow
                key={id}
                title={localized(branch.name)}
                control={
                  <Switch
                    aria-label={localized(branch.name)}
                    checked={onTalabat.includes(id)}
                    disabled={save.isPending}
                    onCheckedChange={(on) => toggleBranch(id, on)}
                  />
                }
              />
            )
          })
        )}
        <SettingRow
          title={t('talabatSyncOpenClose')}
          description={t('talabatSyncOpenCloseHint')}
          control={
            <Switch
              aria-label={t('talabatSyncOpenClose')}
              checked={status.syncOpenClose}
              disabled={save.isPending}
              onCheckedChange={(on) => saveWith(onTalabat, on)}
            />
          }
        />
      </SettingsCard>

      {/* The menu Talabat shows */}
      <SettingsCard title={t('talabatMenu')} description={t('talabatMenuHint')}>
        <SettingRow
          title={
            status.menuSentAt
              ? t('talabatMenuSent', { time: when(status.menuSentAt)! })
              : t('talabatMenuNeverSent')
          }
          description={
            menuNotes ? (
              <span className='grid gap-0.5'>
                {status.lastMenuResult && (
                  <span>
                    {t('talabatMenuResult', { result: status.lastMenuResult })}
                  </span>
                )}
                {waiting && <span>{t('talabatMenuWaiting')}</span>}
                {pending > 0 && (
                  <span>{t('talabatPending', { count: pending })}</span>
                )}
              </span>
            ) : undefined
          }
          control={
            <Button
              type='button'
              variant='outline'
              disabled={sending || onTalabat.length === 0 || !status.connected}
              onClick={sendNow}
            >
              {sending ? <Spinner /> : <Send className='rtl:-scale-x-100' />}
              {t('talabatSendNow')}
            </Button>
          }
        />
        {onTalabat[0] != null && <MenuPreview branchId={onTalabat[0]} />}
      </SettingsCard>

      {/* What Talabat turned down */}
      {status.failed.length > 0 && (
        <SettingsCard title={t('talabatRefusals')}>
          {status.failed.map((f, i) => {
            const kind = REFUSAL_KINDS[f.kind]
            const branch = branches.find(
              (b) => Number(b.id) === Number(f.branchId)
            )
            return (
              <div key={i} className='space-y-1 px-5 py-3 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge variant='outline'>{kind ? t(kind) : f.kind}</Badge>
                  {branch && <span>{localized(branch.name)}</span>}
                  {f.code && (
                    <span
                      className='text-muted-foreground font-mono text-xs'
                      dir='ltr'
                    >
                      {f.code}
                    </span>
                  )}
                  <When
                    value={f.at}
                    className='text-muted-foreground ms-auto text-xs'
                  />
                </div>
                {f.error && (
                  <p
                    className='text-muted-foreground font-mono text-xs break-all'
                    dir='ltr'
                  >
                    {f.error}
                  </p>
                )}
              </div>
            )
          })}
        </SettingsCard>
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
  const items = (
    preview.data as { items?: Record<string, CatalogItem> } | undefined
  )?.items
  if (!items) return null

  const all = Object.entries(items)
  const dishes = all.filter(([id]) => id.startsWith('item-')).length
  const options = all.filter(([id]) => id.startsWith('option-')).length
  const categories = all.filter(([, item]) => item.type === 'Category').length

  return (
    <div className='space-y-3 px-5 py-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='min-w-0'>
          <div className='text-sm font-medium'>{t('talabatPreview')}</div>
          <div className='text-muted-foreground mt-0.5 text-sm'>
            {t('talabatPreviewCounts', { dishes, options, categories })}
          </div>
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('talabatPreviewHide') : t('talabatPreviewShow')}
          <ChevronDown className={open ? 'rotate-180' : undefined} />
        </Button>
      </div>
      {open && (
        <pre
          dir='ltr'
          className='bg-muted max-h-96 overflow-auto rounded-md p-3 text-xs'
        >
          {JSON.stringify(preview.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
