import { useState } from 'react'
import type { AxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type PromoCodeDto, type PromoCodeRequest } from '@/api/catalog'
import {
  createPromoMutation,
  updatePromoMutation,
} from '@/api/catalog/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { formatDay } from '@/lib/business-day'
import { useCurrencyLabel } from '@/lib/currency'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { DatePicker } from '@/components/date-picker'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid, SwitchRow } from '@/components/field'
import { PROMO_KIND } from '../promo-kind'

interface PromoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promo: PromoCodeDto | null
}

export function PromoDialog({ open, onOpenChange, promo }: PromoDialogProps) {
  const t = useT()
  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={promo ? t('editPromoCode') : t('newPromoCode')}
    >
      {/* Keyed so form state resets per code; closing unmounts it */}
      <PromoForm
        key={String(promo?.id ?? 'new')}
        promo={promo}
        onOpenChange={onOpenChange}
      />
    </EntitySheet>
  )
}

// The window is picked by day. It starts at the first day's midnight and
// ends when the day after the last one begins, so the last day counts.
const dayStart = (day: string) => new Date(`${day}T00:00:00`)
const lastDayOf = (endsAt: string) => {
  const end = new Date(endsAt)
  end.setDate(end.getDate() - 1)
  return formatDay(end)
}

function PromoForm({
  promo,
  onOpenChange,
}: {
  promo: PromoCodeDto | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const currency = useCurrencyLabel()
  const queryClient = useQueryClient()
  const isEditing = !!promo

  const [form, setForm] = useState({
    code: promo?.code ?? '',
    kind: Number(promo?.kind ?? PROMO_KIND.percent),
    value: promo ? String(Number(promo.value)) : '',
    minSubtotal:
      promo?.minSubtotal != null ? String(Number(promo.minSubtotal)) : '',
    from: promo?.startsAt ? formatDay(new Date(promo.startsAt)) : '',
    until: promo?.endsAt ? lastDayOf(promo.endsAt) : '',
    maxUses: promo?.maxUses != null ? String(Number(promo.maxUses)) : '',
    oncePerCustomer: promo?.oncePerCustomer ?? true,
  })
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'listPromos' }] })
    toast.success(t('promoSaved'))
    onOpenChange(false)
  }
  // Catalog explains a refused code (taken, percent over 100…) in the
  // problem detail; show that rather than a generic failure
  const onError = (err: AxiosError) => {
    const detail = (err.response?.data as { detail?: string } | undefined)
      ?.detail
    toast.error(detail || t('failedToSavePromo'))
  }

  const create = useMutation({ ...createPromoMutation(), onSuccess, onError })
  const update = useMutation({ ...updatePromoMutation(), onSuccess, onError })
  const isSaving = create.isPending || update.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = form.code.trim().toUpperCase()
    const value = parseFloat(form.value)
    if (!code) return setError(t('promoCodeRequired'))
    if (!(value > 0)) return setError(t('discountRequired'))
    setError('')

    const body: PromoCodeRequest = {
      code,
      kind: form.kind,
      value,
      minSubtotal: form.minSubtotal ? parseFloat(form.minSubtotal) : null,
      startsAt: form.from ? dayStart(form.from).toISOString() : null,
      endsAt: form.until
        ? (() => {
            const end = dayStart(form.until)
            end.setDate(end.getDate() + 1)
            return end.toISOString()
          })()
        : null,
      maxUses: form.maxUses ? parseInt(form.maxUses, 10) : null,
      oncePerCustomer: form.oncePerCustomer,
      isActive: promo?.isActive ?? true,
    }

    if (isEditing) {
      update.mutate({
        path: { id: Number(promo.id) },
        body,
        query: { 'api-version': API_VERSION },
      })
    } else {
      create.mutate({ body, query: { 'api-version': API_VERSION } })
    }
  }

  return (
    <form id='promo-form' onSubmit={handleSubmit} className='space-y-4'>
      <Field label={t('promoCode')} htmlFor='promo-code'>
        <Input
          id='promo-code'
          value={form.code}
          onChange={(e) => set('code', e.target.value)}
          className='font-mono uppercase'
          maxLength={20}
          autoFocus={!isEditing}
        />
      </Field>

      <FieldGrid>
        <Field label={t('discount')}>
          <Select
            value={String(form.kind)}
            onValueChange={(v) => set('kind', Number(v))}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={String(PROMO_KIND.percent)}>
                {t('percentOff')}
              </SelectItem>
              <SelectItem value={String(PROMO_KIND.amount)}>
                {t('amountOff')}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={form.kind === PROMO_KIND.percent ? '%' : currency}
          htmlFor='promo-value'
        >
          <Input
            id='promo-value'
            type='number'
            step={form.kind === PROMO_KIND.percent ? '1' : '0.01'}
            min='0'
            max={form.kind === PROMO_KIND.percent ? 100 : undefined}
            value={form.value}
            onChange={(e) => set('value', e.target.value)}
          />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label={`${t('minimumOrder')} (${currency})`} htmlFor='promo-min'>
          <Input
            id='promo-min'
            type='number'
            step='0.01'
            min='0'
            value={form.minSubtotal}
            onChange={(e) => set('minSubtotal', e.target.value)}
          />
        </Field>
        <Field label={t('maxUses')} htmlFor='promo-max'>
          <Input
            id='promo-max'
            type='number'
            step='1'
            min='1'
            placeholder={t('unlimited')}
            value={form.maxUses}
            onChange={(e) => set('maxUses', e.target.value)}
          />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label={t('validFrom')}>
          <DatePicker
            value={form.from}
            onChange={(v) => set('from', v)}
            placeholder={t('always')}
          />
        </Field>
        <Field label={t('validUntil')}>
          <DatePicker
            value={form.until}
            onChange={(v) => set('until', v)}
            placeholder={t('always')}
          />
        </Field>
      </FieldGrid>

      <SwitchRow
        title={t('oncePerCustomer')}
        checked={form.oncePerCustomer}
        onCheckedChange={(v) => set('oncePerCustomer', v)}
      />

      {error && <p className='text-destructive text-sm'>{error}</p>}

      <SheetActions>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' form='promo-form' disabled={isSaving}>
          {isSaving && <Spinner />}
          {t('save')}
        </Button>
      </SheetActions>
    </form>
  )
}
