import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Truck } from 'lucide-react'
import {
  addCourierProviderMutation,
  getCourierProvidersOptions,
  updateCourierProviderMutation,
} from '@/api/ordering/@tanstack/react-query.gen'
import { type CourierProviderView } from '@/api/ordering/types.gen'
import {
  addCourierPayoutMutation,
  getCourierBalancesOptions,
  getCourierJobsOptions,
  getCourierPayoutsOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { type CourierBalanceView } from '@/api/sales/types.gen'
import { API_VERSION } from '@/lib/api-client'
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
import { SwitchRow } from '@/components/field'
import { Main } from '@/components/layout/main'
import { ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { Section } from '@/components/section'
import { When } from '@/components/when'

const q = { 'api-version': API_VERSION }

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
  const providers = useQuery(getCourierProvidersOptions({ query: q }))
  const balances = useQuery(getCourierBalancesOptions({ query: q }))
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)

  const rows = providers.data ?? []
  const balanceOf = (id: number) =>
    (balances.data ?? []).find((b) => toNumber(b.providerId) === id)
  const owedToUs = (balances.data ?? []).reduce(
    (sum, b) => sum + Math.max(0, toNumber(b.balance)),
    0
  )
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
                <li
                  key={id}
                  className='hover:bg-muted cursor-pointer px-4 py-3'
                  onClick={() => setOpenId(id)}
                >
                  <ListRow
                    className={cn(!p.isActive && 'opacity-60')}
                    leading={<EntityAvatar name={p.name ?? ''} />}
                    title={
                      <span className={cn(!p.isActive && 'line-through')}>
                        {p.name}
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
  if (balance > 0)
    return (
      <span className='text-muted-foreground text-xs'>
        {t('courierOwesUs')}
      </span>
    )
  if (balance < 0)
    return <span className='text-warning text-xs'>{t('weOweCourier')}</span>
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
            <CourierForm
              key={String(provider.id)}
              provider={provider}
              onSaved={() => {}}
            />
          </Section>
          <Section title={t('account')}>
            <CourierAccount provider={provider} balance={balance} />
          </Section>
        </>
      ) : null}
    </EntitySheet>
  )
}

function CourierForm({
  provider,
  onSaved,
}: {
  provider: CourierProviderView | null
  onSaved: () => void
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [name, setName] = useState(provider?.name ?? '')
  const [phone, setPhone] = useState(provider?.phone ?? '')
  const [fee, setFee] = useState(
    provider?.defaultFee == null ? '' : String(toNumber(provider.defaultFee))
  )
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
        query: q,
      })
    else add.mutate({ body, query: q })
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
        <Button
          type='submit'
          form='courier-form'
          disabled={name.trim() === '' || !feeOk || busy}
        >
          {busy && <Spinner />}
          {provider ? t('save') : t('addCourierCompany')}
        </Button>
      </SheetActions>
    </form>
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
      query: { ...q, pageSize: 25 },
    })
  )
  const payouts = useQuery(
    getCourierPayoutsOptions({ path: { providerId }, query: q })
  )
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
        <span className='text-lg font-semibold tabular-nums'>
          {formatEgp(Math.abs(owed))}
        </span>
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
            query: q,
          })
        }}
      >
        <span className='text-sm font-medium'>{t('courierRecordPayment')}</span>
        <div className='grid grid-cols-2 gap-2'>
          <Button
            type='button'
            variant={direction === 'in' ? 'default' : 'outline'}
            onClick={() => setDirection('in')}
          >
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
          <p className='text-muted-foreground text-sm'>
            {t('courierNoDeliveries')}
          </p>
        ) : (
          <ul className='divide-y rounded-lg border text-sm'>
            {(jobs.data?.items ?? []).map((job) => (
              <li
                key={String(job.orderId)}
                className='flex items-center gap-3 px-3 py-2'
              >
                <span className='min-w-0 flex-1'>
                  <span className='block font-medium tabular-nums'>
                    {t('orderNumber', { id: toNumber(job.orderId) })}
                  </span>
                  <span className='text-muted-foreground block text-xs'>
                    {job.outcome && outcomeKey[job.outcome]
                      ? t(outcomeKey[job.outcome])
                      : job.outcome}
                    {' · '}
                    <When value={job.at} />
                  </span>
                </span>
                <span className='text-end tabular-nums'>
                  <span className='block'>
                    {formatEgp(toNumber(job.collected))}
                  </span>
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
                <li
                  key={String(p.id)}
                  className='flex items-center gap-3 px-3 py-2'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='block'>
                      {paid > 0 ? t('courierPaidUs') : t('wePaidCourier')}
                    </span>
                    <span className='text-muted-foreground block truncate text-xs'>
                      {p.paidOn}
                      {p.note ? ` · ${p.note}` : ''}
                    </span>
                  </span>
                  <span className='tabular-nums'>
                    {formatEgp(Math.abs(paid))}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
