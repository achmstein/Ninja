import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Plug, Plus, Truck } from 'lucide-react'
import { type CourierProviderView, type CourierTestJobView } from '@ninja/api/ordering/types.gen'
import { type CourierBalanceView } from '@ninja/api/sales/types.gen'
import { useT, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/empty-state'
import { EntityAvatar } from '@/components/entity-avatar'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { ErrorState } from '@/components/error-state'
import { Field, SwitchRow } from '@/components/field'
import { Main } from '@/components/layout/main'
import { ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { Section } from '@/components/section'
import { When } from '@/components/when'
import {
  addCourierProviderMutation,
  newCourierWebhookSecretMutation,
  sendCourierTestJobMutation,
  setCourierConnectionMutation,
  updateCourierProviderMutation,
} from './api/mutations'
import { addCourierPayoutMutation } from './api/mutations'
import { getCourierCallsOptions, getCourierConnectionOptions, getCourierProvidersOptions } from './api/queries'
import { getCourierBalancesOptions, getCourierJobsOptions, getCourierPayoutsOptions } from './api/queries'

/** The server's own words for a refusal, when it gave some */
const refusal = (error: unknown) =>
  error instanceof AxiosError && typeof error.response?.data?.detail === 'string'
    ? (error.response.data.detail as string)
    : null

/** What became of a courier's delivery, in the admin's words */
const outcomeKey: Record<string, TranslationKey> = {
  Pending: 'courierOutcomePending',
  Settled: 'courierOutcomeSettled',
  Short: 'courierOutcomeShort',
  AlreadySettled: 'courierOutcomeAlreadySettled',
  Failed: 'courierOutcomeFailed',
}

/**
 * The courier companies the business hands deliveries to when it has no rider
 * for one, and the money between them: what each company's couriers collected
 * for the business, its fees, what was settled, and so what is owed either way.
 * The till offers the companies switched on, after the branch's riders.
 */
export function Couriers() {
  const t = useT()
  const providers = useQuery(getCourierProvidersOptions())
  const balances = useQuery(getCourierBalancesOptions())
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const rows = providers.data ?? []
  const balanceOf = (id: number) => (balances.data ?? []).find((b) => toNumber(b.providerId) === id)
  const owedToUs = (balances.data ?? []).reduce((sum, b) => sum + Math.max(0, toNumber(b.balance)), 0)
  const selected = rows.find((p) => toNumber(p.id) === openId) ?? null

  return (
    <>
      <Main>
        <PageHeader
          title={t('couriersNav')}
          badge={
            owedToUs > 0 ? (
              <span className='text-muted-foreground text-sm tabular-nums'>
                {t('couriersOweUs', { amount: formatEgp(owedToUs) })}
              </span>
            ) : null
          }
          actions={
            <Button size='sm' onClick={() => setAdding(true)}>
              <Plus />
              {t('addCourierCompany')}
            </Button>
          }
        />

        {providers.isError ? (
          <ErrorState error={providers.error} onRetry={providers.refetch} />
        ) : providers.isLoading ? (
          <Skeleton className='h-48' />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={t('noCourierCompanies')}
            description={t('noCourierCompaniesHint')}
            action={
              <Button onClick={() => setAdding(true)}>
                <Plus />
                {t('addCourierCompany')}
              </Button>
            }
          />
        ) : (
          <ul className='divide-y overflow-hidden rounded-lg border'>
            {rows.map((p) => {
              const id = toNumber(p.id)
              const balance = balanceOf(id)
              const owed = toNumber(balance?.balance)
              return (
                <li key={id} className='hover:bg-muted cursor-pointer px-4 py-3' onClick={() => setOpenId(id)}>
                  <ListRow
                    className={cn(!p.isActive && 'opacity-60')}
                    leading={<EntityAvatar name={p.name ?? ''} />}
                    title={
                      <span className='flex items-center gap-1.5'>
                        <span className={cn(!p.isActive && 'line-through')}>{p.name}</span>
                        {p.isConnected && (
                          <Plug className='text-muted-foreground size-3.5' aria-label={t('courierConnected')} />
                        )}
                      </span>
                    }
                    meta={
                      <span className='tabular-nums'>
                        {t('courierDeliveries', {
                          count: toNumber(balance?.deliveries),
                        })}
                        {p.defaultFee != null && (
                          <>
                            {' · '}
                            {t('courierUsualFee', {
                              amount: formatEgp(toNumber(p.defaultFee)),
                            })}
                          </>
                        )}
                      </span>
                    }
                    trailing={<Money value={Math.abs(owed)} strong dashZero />}
                    trailingMeta={<BalanceWords balance={owed} />}
                  />
                </li>
              )
            })}
          </ul>
        )}
      </Main>

      <CourierSheet
        provider={selected}
        balance={selected ? balanceOf(toNumber(selected.id)) : undefined}
        isNew={adding}
        onClose={() => {
          setAdding(false)
          setOpenId(null)
        }}
      />
    </>
  )
}

/** Which way the money is owed, in words: never the sign alone */
function BalanceWords({ balance }: { balance: number }) {
  const t = useT()
  if (balance > 0) return <span className='text-muted-foreground text-xs'>{t('courierOwesUs')}</span>
  if (balance < 0) return <span className='text-warning text-xs'>{t('weOweCourier')}</span>
  return null
}

function CourierSheet({
  provider,
  balance,
  isNew,
  onClose,
}: {
  provider: CourierProviderView | null
  balance: CourierBalanceView | undefined
  isNew: boolean
  onClose: () => void
}) {
  const t = useT()
  const open = isNew || provider !== null
  return (
    <EntitySheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={isNew ? t('addCourierCompany') : (provider?.name ?? '')}
      flush
    >
      {isNew ? (
        <Section title={t('details')}>
          <CourierForm key='new' provider={null} onSaved={onClose} />
        </Section>
      ) : provider ? (
        <>
          <Section title={t('details')}>
            <CourierForm key={String(provider.id)} provider={provider} onSaved={() => {}} />
          </Section>
          <Section title={t('courierConnectionTitle')}>
            <CourierConnection key={String(provider.id)} providerId={toNumber(provider.id)} />
          </Section>
          <Section title={t('account')}>
            <CourierAccount provider={provider} balance={balance} />
          </Section>
        </>
      ) : null}
    </EntitySheet>
  )
}

function CourierForm({ provider, onSaved }: { provider: CourierProviderView | null; onSaved: () => void }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [name, setName] = useState(provider?.name ?? '')
  const [phone, setPhone] = useState(provider?.phone ?? '')
  const [fee, setFee] = useState(provider?.defaultFee == null ? '' : String(toNumber(provider.defaultFee)))
  const [isActive, setIsActive] = useState(provider?.isActive ?? true)
  const saved = () => {
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getCourierProviders' }],
    })
    toast.success(t('courierCompanySaved'))
    onSaved()
  }
  const add = useMutation({
    ...addCourierProviderMutation(),
    onSuccess: saved,
    onError: () => toast.error(t('somethingWentWrong')),
  })
  const update = useMutation({
    ...updateCourierProviderMutation(),
    onSuccess: saved,
    onError: () => toast.error(t('somethingWentWrong')),
  })
  const feeValue = fee.trim() === '' ? null : Number(fee.replace(',', '.'))
  const feeOk = feeValue == null || (Number.isFinite(feeValue) && feeValue >= 0)
  const busy = add.isPending || update.isPending

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = {
      name: name.trim(),
      phone: phone.trim() || null,
      defaultFee: feeValue,
      isActive,
    }
    if (provider)
      update.mutate({
        path: { providerId: toNumber(provider.id) },
        body,
      })
    else add.mutate({ body })
  }

  return (
    <form id='courier-form' onSubmit={submit} className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='courier-name'>{t('name')}</Label>
          <Input
            id='courier-name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            autoFocus={!provider}
            required
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='courier-phone'>{t('phone')}</Label>
          <Input
            id='courier-phone'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={30}
            inputMode='tel'
            dir='ltr'
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='courier-fee'>{t('courierUsualFeeLabel')}</Label>
          <Input
            id='courier-fee'
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            inputMode='decimal'
            dir='ltr'
            aria-invalid={!feeOk}
            className='tabular-nums'
          />
        </div>
      </div>
      {provider && (
        <SwitchRow
          title={t('courierOffered')}
          description={t('courierOfferedHint')}
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      )}
      <SheetActions>
        <Button type='submit' form='courier-form' disabled={name.trim() === '' || !feeOk || busy}>
          {busy && <Spinner />}
          {provider ? t('save') : t('addCourierCompany')}
        </Button>
      </SheetActions>
    </form>
  )
}

/**
 * The company's own system, connected through Ninja's courier API: a delivery
 * given to it reaches its system as a job, and its courier's steps come back on
 * their own. The key it gave the business and the secret it signs with are
 * never shown again once saved; the secret is shown the once it is made.
 */
function CourierConnection({ providerId }: { providerId: number }) {
  const t = useT()
  const queryClient = useQueryClient()
  const path = { providerId }
  const connection = useQuery(getCourierConnectionOptions({ path }))
  const [address, setAddress] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [secret, setSecret] = useState<string | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getCourierConnection' }],
    })
    queryClient.invalidateQueries({
      queryKey: [{ _id: 'getCourierProviders' }],
    })
  }
  const save = useMutation({
    ...setCourierConnectionMutation(),
    onSuccess: (view) => {
      refresh()
      setApiKey('')
      setAddress(null)
      if (!view.connected) setSecret(null)
      toast.success(t(view.connected ? 'courierConnectionSaved' : 'courierDisconnected'))
    },
    onError: (e) => toast.error(refusal(e) ?? t('somethingWentWrong')),
  })
  const makeSecret = useMutation({
    ...newCourierWebhookSecretMutation(),
    onSuccess: (made) => {
      refresh()
      setSecret(made.secret)
    },
    onError: (e) => toast.error(refusal(e) ?? t('somethingWentWrong')),
  })

  if (connection.isError) return <ErrorState error={connection.error} onRetry={connection.refetch} />
  if (!connection.data) return <Skeleton className='h-24' />
  const view = connection.data
  const shownAddress = address ?? view.apiBaseUrl ?? ''
  const busy = save.isPending || makeSecret.isPending

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success(t('courierCopied'))
  }

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>{t('courierConnectionHint')}</p>
      {!view.canKeepSecrets && <p className='text-warning text-sm'>{t('courierCannotKeepSecrets')}</p>}
      <form
        id='courier-connection'
        className='space-y-4'
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate({
            path,
            body: {
              apiBaseUrl: shownAddress.trim(),
              apiKey: apiKey.trim() || null,
            },
          })
        }}
      >
        <Field label={t('courierApiAddress')} htmlFor='courier-api-address'>
          <Input
            id='courier-api-address'
            value={shownAddress}
            onChange={(e) => setAddress(e.target.value)}
            placeholder='https://'
            maxLength={500}
            inputMode='url'
            dir='ltr'
            disabled={!view.canKeepSecrets}
          />
        </Field>
        <Field
          label={t('courierApiKey')}
          htmlFor='courier-api-key'
          hint={view.hasApiKey ? t('courierApiKeyKept') : undefined}
        >
          <Input
            id='courier-api-key'
            type='password'
            autoComplete='off'
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            maxLength={500}
            dir='ltr'
            disabled={!view.canKeepSecrets}
          />
        </Field>
        <div className='flex flex-wrap gap-2'>
          <Button type='submit' variant='outline' disabled={busy || !view.canKeepSecrets || shownAddress.trim() === ''}>
            {save.isPending && <Spinner />}
            <Plug />
            {view.connected ? t('save') : t('courierConnect')}
          </Button>
          {view.connected && (
            <Button
              type='button'
              variant='ghost'
              disabled={busy}
              onClick={() => save.mutate({ path, body: { apiBaseUrl: '' } })}
            >
              {t('courierDisconnect')}
            </Button>
          )}
        </div>
      </form>

      {view.connected && (
        <div className='space-y-4 border-t pt-4'>
          <Field label={t('courierStatusUrl')} htmlFor='courier-status-url' hint={t('courierStatusUrlHint')}>
            <div className='flex gap-2'>
              <Input
                id='courier-status-url'
                value={view.statusUrl}
                readOnly
                dir='ltr'
                className='font-mono text-xs'
                onFocus={(e) => e.target.select()}
              />
              <Button type='button' variant='outline' onClick={() => copy(view.statusUrl)}>
                <Copy />
                {t('copy')}
              </Button>
            </div>
          </Field>
          {secret ? (
            <Field label={t('courierSigningSecret')} htmlFor='courier-secret' hint={t('courierSigningSecretOnce')}>
              <div className='flex gap-2'>
                <Input
                  id='courier-secret'
                  value={secret}
                  readOnly
                  dir='ltr'
                  className='font-mono text-xs'
                  onFocus={(e) => e.target.select()}
                />
                <Button type='button' variant='outline' onClick={() => copy(secret)}>
                  <Copy />
                  {t('copy')}
                </Button>
              </div>
            </Field>
          ) : (
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span className='text-muted-foreground text-sm'>
                {t(view.hasWebhookSecret ? 'courierSigningSecretKept' : 'courierSigningSecretNone')}
              </span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={busy}
                onClick={() => makeSecret.mutate({ path })}
              >
                {makeSecret.isPending && <Spinner />}
                {t(view.hasWebhookSecret ? 'courierSigningSecretRenew' : 'courierSigningSecretMake')}
              </Button>
            </div>
          )}
          <CourierTestKit providerId={providerId} />
        </div>
      )}
    </div>
  )
}

/**
 * Trying a connection: a test job sent to the company's system (marked test,
 * nothing to deliver) and what it answered, then the company's recent status
 * calls and how each was answered. A wrong secret or a clock off shows as 401.
 */
function CourierTestKit({ providerId }: { providerId: number }) {
  const t = useT()
  const path = { providerId }
  const calls = useQuery(getCourierCallsOptions({ path }))
  const [result, setResult] = useState<CourierTestJobView | null>(null)
  const test = useMutation({
    ...sendCourierTestJobMutation(),
    onSuccess: setResult,
    onError: (e) => toast.error(refusal(e) ?? t('somethingWentWrong')),
  })
  const rows = calls.data ?? []

  return (
    <div className='space-y-3 border-t pt-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='text-sm font-medium'>{t('courierTestTitle')}</span>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={test.isPending}
          onClick={() => test.mutate({ path })}
        >
          {test.isPending && <Spinner />}
          {t('courierTestSend')}
        </Button>
      </div>
      <p className='text-muted-foreground text-sm'>{t('courierTestHint')}</p>
      {result && (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            result.taken ? 'border-success/40' : 'border-destructive/40'
          )}
        >
          <p className='font-medium'>
            {result.taken
              ? t('courierTestTaken', {
                  job: result.jobId ?? '',
                  ms: toNumber(result.elapsedMs),
                })
              : result.statusCode != null
                ? t('courierTestRefused', {
                    code: toNumber(result.statusCode),
                  })
                : t('courierTestNoAnswer')}
          </p>
          {result.taken && (
            <p className='text-muted-foreground text-xs'>
              {t(result.cancelled ? 'courierTestCancelled' : 'courierTestNotCancelled')}
            </p>
          )}
          {result.detail && (
            <pre dir='ltr' className='text-muted-foreground mt-1 text-xs break-all whitespace-pre-wrap'>
              {result.detail}
            </pre>
          )}
        </div>
      )}

      <div className='flex items-center justify-between gap-2 pt-1'>
        <span className='text-sm font-medium'>{t('courierCallsTitle')}</span>
        <Button type='button' variant='ghost' size='sm' disabled={calls.isFetching} onClick={() => calls.refetch()}>
          {calls.isFetching && <Spinner />}
          {t('courierCallsRefresh')}
        </Button>
      </div>
      {calls.isError ? (
        <ErrorState error={calls.error} onRetry={calls.refetch} />
      ) : rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>{t('courierCallsNone')}</p>
      ) : (
        <ul className='divide-y rounded-md border text-sm'>
          {rows.map((call, i) => {
            const result = toNumber(call.result)
            return (
              <li key={i} className='flex items-start gap-3 px-3 py-2'>
                <span
                  className={cn(
                    'w-10 shrink-0 font-mono text-xs tabular-nums',
                    result < 300 ? 'text-success' : 'text-destructive'
                  )}
                >
                  {result}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate' dir='ltr'>
                    {[
                      call.status,
                      call.orderId != null ? `#${toNumber(call.orderId)}` : null,
                      call.sequence != null ? `seq ${toNumber(call.sequence)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </span>
                  {call.detail && <span className='text-muted-foreground block text-xs break-all'>{call.detail}</span>}
                </span>
                <When value={call.receivedAt} className='text-muted-foreground shrink-0 text-xs' />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** The money with one company: the figures, money settled either way, its deliveries and payments */
function CourierAccount({
  provider,
  balance,
}: {
  provider: CourierProviderView
  balance: CourierBalanceView | undefined
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const providerId = toNumber(provider.id)
  const jobs = useQuery(
    getCourierJobsOptions({
      path: { providerId },
      query: { pageSize: 25 },
    })
  )
  const payouts = useQuery(getCourierPayoutsOptions({ path: { providerId } }))
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const pay = useMutation({
    ...addCourierPayoutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getCourierBalances' }],
      })
      queryClient.invalidateQueries({
        queryKey: [{ _id: 'getCourierPayouts' }],
      })
      setAmount('')
      setNote('')
      toast.success(t('courierPaymentRecorded'))
    },
    onError: () => toast.error(t('somethingWentWrong')),
  })
  const value = Number(amount.replace(',', '.'))
  const valueOk = amount.trim() !== '' && Number.isFinite(value) && value > 0
  const owed = toNumber(balance?.balance)

  const figures: [TranslationKey, number][] = [
    ['courierCollected', toNumber(balance?.collected)],
    ['courierFees', toNumber(balance?.fees)],
    ['courierSettled', toNumber(balance?.settled)],
  ]

  return (
    <div className='space-y-5'>
      <dl className='grid grid-cols-3 gap-3'>
        {figures.map(([label, figure]) => (
          <div key={label} className='rounded-lg border p-3'>
            <dt className='text-muted-foreground text-xs'>{t(label)}</dt>
            <dd className='font-semibold tabular-nums'>{formatEgp(figure)}</dd>
          </div>
        ))}
      </dl>
      <div className='flex items-center justify-between rounded-lg border p-3'>
        <BalanceWords balance={owed} />
        <span className='text-lg font-semibold tabular-nums'>{formatEgp(Math.abs(owed))}</span>
      </div>
      {toNumber(balance?.shortDeliveries) > 0 && (
        <p className='text-warning text-sm'>
          {t('courierShortDeliveries', {
            count: toNumber(balance?.shortDeliveries),
          })}
        </p>
      )}

      {/* Money settled with the company: what it paid the business, or what the business paid it */}
      <form
        className='space-y-3 rounded-lg border p-3'
        onSubmit={(e) => {
          e.preventDefault()
          if (!valueOk) return
          pay.mutate({
            path: { providerId },
            body: {
              amount: direction === 'in' ? value : -value,
              provider: provider.name ?? '',
              note: note.trim() || null,
            },
          })
        }}
      >
        <span className='text-sm font-medium'>{t('courierRecordPayment')}</span>
        <div className='grid grid-cols-2 gap-2'>
          <Button type='button' variant={direction === 'in' ? 'default' : 'outline'} onClick={() => setDirection('in')}>
            {t('courierPaidUs')}
          </Button>
          <Button
            type='button'
            variant={direction === 'out' ? 'default' : 'outline'}
            onClick={() => setDirection('out')}
          >
            {t('wePaidCourier')}
          </Button>
        </div>
        <div className='grid gap-2 sm:grid-cols-2'>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode='decimal'
            dir='ltr'
            placeholder={t('amount')}
            aria-label={t('amount')}
            className='tabular-nums'
          />
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder={t('note')}
            aria-label={t('note')}
          />
        </div>
        <Button type='submit' disabled={!valueOk || pay.isPending}>
          {pay.isPending && <Spinner />}
          {t('courierRecordPayment')}
        </Button>
      </form>

      <div className='space-y-2'>
        <h3 className='text-sm font-medium'>{t('courierRecentDeliveries')}</h3>
        {jobs.isLoading ? (
          <Skeleton className='h-24' />
        ) : (jobs.data?.items ?? []).length === 0 ? (
          <p className='text-muted-foreground text-sm'>{t('courierNoDeliveries')}</p>
        ) : (
          <ul className='divide-y rounded-lg border text-sm'>
            {(jobs.data?.items ?? []).map((job) => (
              <li key={String(job.orderId)} className='flex items-center gap-3 px-3 py-2'>
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium tabular-nums'>
                    {t('orderNumber', { id: toNumber(job.orderId) })}
                  </span>
                  <span className='text-muted-foreground block text-xs'>
                    {job.outcome && outcomeKey[job.outcome] ? t(outcomeKey[job.outcome]) : job.outcome}
                    {' · '}
                    <When value={job.at} />
                  </span>
                </span>
                <span className='text-end tabular-nums'>
                  <span className='block'>{formatEgp(toNumber(job.collected))}</span>
                  <span className='text-muted-foreground block text-xs'>
                    {t('courierFeeShort', {
                      amount: formatEgp(toNumber(job.fee)),
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(payouts.data ?? []).length > 0 && (
        <div className='space-y-2'>
          <h3 className='text-sm font-medium'>{t('courierPayments')}</h3>
          <ul className='divide-y rounded-lg border text-sm'>
            {(payouts.data ?? []).map((p) => {
              const paid = toNumber(p.amount)
              return (
                <li key={String(p.id)} className='flex items-center gap-3 px-3 py-2'>
                  <span className='min-w-0 flex-1'>
                    <span className='block'>{paid > 0 ? t('courierPaidUs') : t('wePaidCourier')}</span>
                    <span className='text-muted-foreground block truncate text-xs'>
                      {p.paidOn}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </span>
                  <span className='tabular-nums'>{formatEgp(Math.abs(paid))}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
