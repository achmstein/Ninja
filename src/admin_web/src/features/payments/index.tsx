import { useState } from 'react'
import { AxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Copy, FlaskConical, Plus, X } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ErrorState } from '@/components/error-state'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/page-header'
import {
  FEE_CAFE,
  FEE_GUEST,
  MAX_TIPS,
  TIP_MAX,
  TIP_MIN,
  canAddTip,
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
  tips: 'payProblemTips',
}

/** The server's one-line reason, when the error carried ProblemDetails. */
function problemDetail(e: unknown): string | undefined {
  if (!(e instanceof AxiosError)) return undefined
  const data = e.response?.data as { detail?: string } | undefined
  return data?.detail
}

/**
 * Online payments, the owner's side: the café's own Paymob account (keys,
 * integrations, the callback to paste into Paymob), who pays the fee, the
 * tips offered and how guests may split a bill.
 */
export function PaymentSettingsPage() {
  const t = useT()
  const query = useQuery(getPaymentSettingsOptions(settingsQuery))
  const settings = query.data

  return (
    <Main>
      <div className='mx-auto w-full max-w-3xl space-y-6'>
        <PageHeader
          title={t('onlinePaymentsNav')}
          description={t('paySettingsDescription')}
          badge={
            settings &&
            (settings.ready ? (
              <Badge className='bg-emerald-600 text-white hover:bg-emerald-600'>
                {t('payReady')}
              </Badge>
            ) : settings.simulated ? (
              <Badge variant='secondary'>{t('payDemoBadge')}</Badge>
            ) : (
              <Badge variant='outline'>{t('payNotReady')}</Badge>
            ))
          }
        />
        {query.error ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : settings ? (
          // Re-seeded from every save: the secrets go back to "kept"
          <SettingsForm key={query.dataUpdatedAt} settings={settings} />
        ) : (
          <Skeleton className='h-[40rem] w-full' />
        )}
      </div>
    </Main>
  )
}

function SettingsForm({ settings }: { settings: PaymentSettingsView }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<PaymentsForm>(() => toForm(settings))
  const [problem, setProblem] = useState<string | null>(null)
  const [tipDraft, setTipDraft] = useState('')
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

  const tipValue = Number(tipDraft)
  const addTip = () => {
    if (!canAddTip(form.tipPercents, tipValue)) return
    set(
      'tipPercents',
      [...form.tipPercents, tipValue].sort((a, b) => a - b)
    )
    setTipDraft('')
  }

  const copyCallback = () => {
    navigator.clipboard.writeText(settings.callbackUrl)
    toast.success(t('payCallbackCopied'))
  }

  const secretsLocked = !settings.canKeepSecrets

  return (
    <form onSubmit={submit} className='space-y-6'>
      {/* A demo café without its own account yet: guests' payments are pretend until the keys are in */}
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

      {/* The café's own account at the provider */}
      <Card>
        <CardContent className='space-y-5 pt-6'>
          <h2 className='font-semibold'>{t('payAccount')}</h2>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='pay-provider'>{t('payProvider')}</Label>
              <Input
                id='pay-provider'
                value={settings.provider || 'Paymob'}
                disabled
                dir='ltr'
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='pay-currency'>{t('payCurrency')}</Label>
              <Input
                id='pay-currency'
                value={form.currency}
                maxLength={3}
                dir='ltr'
                className='uppercase'
                onChange={(e) => set('currency', e.target.value)}
              />
            </div>
          </div>

          <SecretField
            id='pay-secret-key'
            label={t('paySecretKey')}
            isSet={settings.secretKeySet}
            hint={settings.secretKeyHint}
            edit={form.secretKey}
            onChange={(edit) => set('secretKey', edit)}
            disabled={secretsLocked}
          />
          <div className='space-y-1.5'>
            <Label htmlFor='pay-public-key'>{t('payPublicKey')}</Label>
            <Input
              id='pay-public-key'
              value={form.publicKey}
              dir='ltr'
              autoComplete='off'
              onChange={(e) => set('publicKey', e.target.value)}
            />
          </div>
          <SecretField
            id='pay-hmac'
            label={t('payHmacSecret')}
            isSet={settings.hmacSecretSet}
            edit={form.hmacSecret}
            onChange={(edit) => set('hmacSecret', edit)}
            disabled={secretsLocked}
          />

          <div className='space-y-2'>
            <Label>{t('payIntegrations')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t('payIntegrationsHint')}
            </p>
            <div className='grid gap-4 sm:grid-cols-3'>
              {(
                [
                  ['cardIntegrationId', 'payIntegrationCard'],
                  ['walletIntegrationId', 'payIntegrationWallet'],
                  ['applePayIntegrationId', 'payIntegrationApplePay'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className='space-y-1.5'>
                  <Label htmlFor={`pay-${key}`} className='text-xs'>
                    {t(label)}
                  </Label>
                  <Input
                    id={`pay-${key}`}
                    value={form[key]}
                    inputMode='numeric'
                    dir='ltr'
                    onChange={(e) => set(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='pay-callback'>{t('payCallbackUrl')}</Label>
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
                <Copy className='size-4' />
                {t('copy')}
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>
              {t('payCallbackHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* The provider's fee */}
      <Card>
        <CardContent className='space-y-4 pt-6'>
          <h2 className='font-semibold'>{t('payFee')}</h2>
          <ToggleGroup
            type='single'
            variant='outline'
            value={String(form.feeMode)}
            onValueChange={(v) => v && set('feeMode', Number(v))}
            className='w-full sm:w-auto'
          >
            <ToggleGroupItem value={String(FEE_CAFE)} className='px-4'>
              {t('payFeeCafe')}
            </ToggleGroupItem>
            <ToggleGroupItem value={String(FEE_GUEST)} className='px-4'>
              {t('payFeeGuest')}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className='text-muted-foreground text-xs'>
            {form.feeMode === FEE_GUEST
              ? t('payFeeGuestHint')
              : t('payFeeCafeHint')}
          </p>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='pay-fee-percent'>{t('payFeePercent')}</Label>
              <Input
                id='pay-fee-percent'
                value={form.feePercent}
                inputMode='decimal'
                dir='ltr'
                onChange={(e) => set('feePercent', e.target.value)}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='pay-fee-fixed'>{t('payFeeFixed')}</Label>
              <Input
                id='pay-fee-fixed'
                value={form.feeFixed}
                inputMode='decimal'
                dir='ltr'
                onChange={(e) => set('feeFixed', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What guests see on their phones */}
      <Card>
        <CardContent className='space-y-5 pt-6'>
          <div className='flex items-center justify-between gap-4'>
            <div className='grid gap-1'>
              <Label htmlFor='pay-tips' className='font-semibold'>
                {t('payTips')}
              </Label>
              <p className='text-muted-foreground text-xs'>
                {t('payTipsHint', {
                  max: MAX_TIPS,
                  min: TIP_MIN,
                  top: TIP_MAX,
                })}
              </p>
            </div>
            <Switch
              id='pay-tips'
              checked={form.tipsEnabled}
              onCheckedChange={(v) => set('tipsEnabled', v)}
            />
          </div>
          {form.tipsEnabled && (
            <div className='flex flex-wrap items-center gap-2'>
              {form.tipPercents.map((p) => (
                <Badge
                  key={p}
                  variant='secondary'
                  className='gap-1 py-1 ps-3 pe-1 text-sm'
                >
                  <span dir='ltr'>{p}%</span>
                  <button
                    type='button'
                    className='hover:bg-background/60 rounded-full p-0.5'
                    aria-label={t('remove')}
                    onClick={() =>
                      set(
                        'tipPercents',
                        form.tipPercents.filter((x) => x !== p)
                      )
                    }
                  >
                    <X className='size-3.5' />
                  </button>
                </Badge>
              ))}
              {form.tipPercents.length < MAX_TIPS && (
                <div className='flex items-center gap-1'>
                  <Input
                    value={tipDraft}
                    inputMode='numeric'
                    dir='ltr'
                    placeholder='%'
                    aria-label={t('payAddTip')}
                    className='h-8 w-20'
                    onChange={(e) => setTipDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTip()
                      }
                    }}
                  />
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={!canAddTip(form.tipPercents, tipValue)}
                    onClick={addTip}
                  >
                    <Plus className='size-4' />
                    {t('payAddTip')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className='space-y-2'>
            <Label>{t('paySplitModes')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t('paySplitModesHint')}
            </p>
            <div className='divide-y rounded-lg border'>
              {(
                [
                  ['allowItems', 'paySplitItems'],
                  ['allowEqual', 'paySplitEqual'],
                  ['allowCustom', 'paySplitCustom'],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className='flex items-center justify-between p-3'
                >
                  <Label htmlFor={`pay-${key}`} className='text-sm'>
                    {t(label)}
                  </Label>
                  <Switch
                    id={`pay-${key}`}
                    checked={form[key]}
                    onCheckedChange={(v) => set(key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {problem && <p className='text-destructive text-sm'>{problem}</p>}
      <div className='flex justify-end'>
        <Button type='submit' disabled={save.isPending}>
          {save.isPending ? t('saving') : t('save')}
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
    <div className='space-y-1.5'>
      <Label htmlFor={id}>{label}</Label>
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
        <div className='flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2 text-sm'>
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
    </div>
  )
}
