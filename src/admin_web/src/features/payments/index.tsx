import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Copy, FlaskConical } from 'lucide-react'
import {
  getPaymentSettingsOptions,
  getPaymentSettingsQueryKey,
  savePaymentSettingsMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { PaymentSettingsView } from '@/api/sales/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { useT, type TranslationKey } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ErrorState } from '@/components/error-state'
import { Field, FieldGrid } from '@/components/field'
import { SettingRow, SettingsCard } from '@/components/kit'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import { StatusChip } from '@/components/status-chip'
import {
  FEE_BUSINESS,
  FEE_GUEST,
  toForm,
  toRequest,
  type FormProblem,
  type PaymentsForm,
  type SecretEdit,
} from './form'

const settingsQuery = { query: { 'api-version': API_VERSION } }

const PROBLEMS: Record<FormProblem, TranslationKey> = {
  currency: 'payProblemCurrency',
  integrationId: 'payProblemIntegrationId',
  fee: 'payProblemFee',
}

/** The server's one-line reason, when the error carried ProblemDetails. */
function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  const data = e.response?.data as { detail?: string } | undefined
  return data?.detail
}

const paymobLogo = `${import.meta.env.BASE_URL}platforms/paymob.png`

/**
 * Online payments, the owner's side: the business's own Paymob account (keys,
 * integrations, the callback to paste into Paymob), who pays the fee and
 * how guests may split a bill.
 */
export function PaymentSettingsPage() {
  const t = useT()
  const query = useQuery(getPaymentSettingsOptions(settingsQuery))
  const settings = query.data
  const provider = settings?.provider || 'Paymob'

  return (
    <Main>
      <PageHeader
        // The provider by its own mark, as Talabat's page wears Talabat's
        title={
          provider.toLowerCase() === 'paymob' ? (
            <span className='flex items-center gap-3'>
              <img src={paymobLogo} alt='Paymob' className='h-6 w-auto' />
            </span>
          ) : (
            <span dir='ltr'>{provider}</span>
          )
        }
        description={t('paySettingsDescription')}
        badge={
          settings &&
          (settings.ready ? (
            <StatusChip tone='success'>{t('payReady')}</StatusChip>
          ) : settings.simulated ? (
            <StatusChip tone='info'>{t('payDemoBadge')}</StatusChip>
          ) : (
            <StatusChip tone='warning'>{t('payNotReady')}</StatusChip>
          ))
        }
      />
      {query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : settings ? (
        // Re-seeded from every save: the secrets go back to "kept"
        <SettingsForm key={query.dataUpdatedAt} settings={settings} />
      ) : (
        <Skeleton className='h-[40rem] w-full rounded-xl' />
      )}
    </Main>
  )
}

function SettingsForm({ settings }: { settings: PaymentSettingsView }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PaymentsForm>(() => toForm(settings))
  const [problem, setProblem] = useState<string | null>(null)
  const set = <K extends keyof PaymentsForm>(key: K, value: PaymentsForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = useMutation({
    ...savePaymentSettingsMutation(),
    onSuccess: (data) => {
      queryClient.setQueryData(getPaymentSettingsQueryKey(settingsQuery), data)
      toast.success(t('paySettingsSaved'))
    },
    onError: (e) => {
      const detail = problemDetail(e)
      setProblem(detail ?? null)
      toast.error(detail || t('paySettingsSaveFailed'))
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const result = toRequest(form)
    if ('problem' in result) {
      setProblem(t(PROBLEMS[result.problem]))
      return
    }
    setProblem(null)
    save.mutate({ ...settingsQuery, body: result.request })
  }

  const copyCallback = () => {
    navigator.clipboard.writeText(settings.callbackUrl)
    toast.success(t('payCallbackCopied'))
  }

  const secretsLocked = !settings.canKeepSecrets

  return (
    <form onSubmit={submit} className='space-y-6'>
      {/* A demo business without its own account yet: guests' payments are pretend until the keys are in */}
      {settings.simulated && (
        <Alert>
          <FlaskConical />
          <AlertDescription className='text-foreground'>
            {t('payDemoNotice')}
          </AlertDescription>
        </Alert>
      )}

      {secretsLocked && (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>{t('payUpgradeTitle')}</AlertTitle>
          <AlertDescription>{t('payUpgradeDescription')}</AlertDescription>
        </Alert>
      )}

      {/* The business's own account at the provider */}
      <SettingsCard title={t('payAccount')}>
        <SettingRow
          title={t('payCurrency')}
          control={
            <Input
              id='pay-currency'
              aria-label={t('payCurrency')}
              value={form.currency}
              maxLength={3}
              dir='ltr'
              className='w-24 uppercase'
              onChange={(e) => set('currency', e.target.value)}
            />
          }
        />
        <div className='grid gap-4 px-5 py-4'>
          <SecretField
            id='pay-secret-key'
            label={t('paySecretKey')}
            isSet={settings.secretKeySet}
            hint={settings.secretKeyHint}
            edit={form.secretKey}
            onChange={(edit) => set('secretKey', edit)}
            disabled={secretsLocked}
          />
          <Field label={t('payPublicKey')} htmlFor='pay-public-key'>
            <Input
              id='pay-public-key'
              value={form.publicKey}
              dir='ltr'
              autoComplete='off'
              onChange={(e) => set('publicKey', e.target.value)}
            />
          </Field>
          <SecretField
            id='pay-hmac'
            label={t('payHmacSecret')}
            isSet={settings.hmacSecretSet}
            edit={form.hmacSecret}
            onChange={(edit) => set('hmacSecret', edit)}
            disabled={secretsLocked}
          />
        </div>
        <div className='grid gap-3 px-5 py-4'>
          <div>
            <div className='text-sm font-medium'>{t('payIntegrations')}</div>
            <p className='text-muted-foreground mt-0.5 text-sm'>
              {t('payIntegrationsHint')}
            </p>
          </div>
          <FieldGrid cols={3}>
            {(
              [
                ['cardIntegrationId', 'payIntegrationCard'],
                ['walletIntegrationId', 'payIntegrationWallet'],
                ['applePayIntegrationId', 'payIntegrationApplePay'],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={t(label)} htmlFor={`pay-${key}`}>
                <Input
                  id={`pay-${key}`}
                  value={form[key]}
                  inputMode='numeric'
                  dir='ltr'
                  onChange={(e) => set(key, e.target.value)}
                />
              </Field>
            ))}
          </FieldGrid>
        </div>
        <div className='px-5 py-4'>
          <Field
            label={t('payCallbackUrl')}
            htmlFor='pay-callback'
            hint={t('payCallbackHint')}
          >
            <div className='flex gap-2'>
              <Input
                id='pay-callback'
                value={settings.callbackUrl}
                readOnly
                dir='ltr'
                className='font-mono text-xs'
                onFocus={(e) => e.target.select()}
              />
              <Button type='button' variant='outline' onClick={copyCallback}>
                <Copy />
                {t('copy')}
              </Button>
            </div>
          </Field>
        </div>
      </SettingsCard>

      {/* The provider's fee */}
      <SettingsCard title={t('payFee')}>
        <div className='grid gap-2 px-5 py-4'>
          <ToggleGroup
            type='single'
            variant='outline'
            value={String(form.feeMode)}
            onValueChange={(v) => v && set('feeMode', Number(v))}
            className='w-full sm:w-auto'
          >
            <ToggleGroupItem value={String(FEE_BUSINESS)} className='px-4'>
              {t('payFeeBusiness')}
            </ToggleGroupItem>
            <ToggleGroupItem value={String(FEE_GUEST)} className='px-4'>
              {t('payFeeGuest')}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className='text-muted-foreground text-sm'>
            {form.feeMode === FEE_GUEST
              ? t('payFeeGuestHint')
              : t('payFeeBusinessHint')}
          </p>
        </div>
        <FieldGrid className='px-5 py-4'>
          <Field label={t('payFeePercent')} htmlFor='pay-fee-percent'>
            <Input
              id='pay-fee-percent'
              value={form.feePercent}
              inputMode='decimal'
              dir='ltr'
              onChange={(e) => set('feePercent', e.target.value)}
            />
          </Field>
          <Field label={t('payFeeFixed')} htmlFor='pay-fee-fixed'>
            <Input
              id='pay-fee-fixed'
              value={form.feeFixed}
              inputMode='decimal'
              dir='ltr'
              onChange={(e) => set('feeFixed', e.target.value)}
            />
          </Field>
        </FieldGrid>
      </SettingsCard>

      {/* What guests see on their phones */}
      <SettingsCard
        title={t('paySplitModes')}
        description={t('paySplitModesHint')}
      >
        {(
          [
            ['allowItems', 'paySplitItems'],
            ['allowEqual', 'paySplitEqual'],
            ['allowCustom', 'paySplitCustom'],
          ] as const
        ).map(([key, label]) => (
          <SettingRow
            key={key}
            title={t(label)}
            control={
              <Switch
                id={`pay-${key}`}
                aria-label={t(label)}
                checked={form[key]}
                onCheckedChange={(v) => set(key, v)}
              />
            }
          />
        ))}
      </SettingsCard>

      {/* One Save for the whole page: the three cards are one settings form */}
      <div className='flex flex-wrap items-center justify-end gap-3'>
        {problem && (
          <p className='text-destructive me-auto text-sm'>{problem}</p>
        )}
        <Button type='submit' disabled={save.isPending}>
          {save.isPending && <Spinner />}
          {t('save')}
        </Button>
      </div>
    </form>
  )
}

/**
 * A secret the server never shows again. Set: "Set ••••1234" with Replace
 * and Remove. Not set, or being replaced: a password field, never prefilled.
 */
function SecretField({
  id,
  label,
  isSet,
  hint,
  edit,
  onChange,
  disabled,
}: {
  id: string
  label: string
  isSet: boolean
  hint?: string | null
  edit: SecretEdit
  onChange: (edit: SecretEdit) => void
  disabled: boolean
}) {
  const t = useT()
  const typing = !isSet || edit.mode === 'replace'

  return (
    <Field label={label} htmlFor={typing ? id : undefined}>
      {typing ? (
        <div className='flex gap-2'>
          <Input
            id={id}
            type='password'
            autoComplete='new-password'
            dir='ltr'
            disabled={disabled}
            value={edit.mode === 'replace' ? edit.value : ''}
            placeholder={isSet ? t('payReplacePlaceholder') : undefined}
            onChange={(e) =>
              onChange({ mode: 'replace', value: e.target.value })
            }
          />
          {isSet && (
            <Button
              type='button'
              variant='ghost'
              onClick={() => onChange({ mode: 'keep' })}
            >
              {t('cancel')}
            </Button>
          )}
        </div>
      ) : edit.mode === 'remove' ? (
        <div className='flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-1.5 text-sm'>
          <span className='text-destructive'>{t('payWillRemove')}</span>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => onChange({ mode: 'keep' })}
          >
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <div className='flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm'>
          <span className='flex items-center gap-2'>
            <Badge variant='secondary'>{t('paySecretSet')}</Badge>
            {hint && (
              <span dir='ltr' className='text-muted-foreground font-mono'>
                ••••{hint}
              </span>
            )}
          </span>
          <span className='flex gap-1'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={disabled}
              onClick={() => onChange({ mode: 'replace', value: '' })}
            >
              {t('payReplace')}
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='text-destructive hover:text-destructive'
              disabled={disabled}
              onClick={() => onChange({ mode: 'remove' })}
            >
              {t('remove')}
            </Button>
          </span>
        </div>
      )}
    </Field>
  )
}
