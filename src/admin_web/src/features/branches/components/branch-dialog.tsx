import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import { type BranchResponse } from '@/api/tenant'
import {
  createBranchMutation,
  updateBranchMutation,
} from '@/api/tenant/@tanstack/react-query.gen'
import { useIsCloudKitchen } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid, SwitchGroup, SwitchRow } from '@/components/field'
import {
  fromLocalizedValue,
  isBlank,
  LocalizedInput,
  toLocalizedValue,
} from '@/components/localized-input'
import { FormFillButton } from '@/features/assist/form-fill-button'
import {
  localizedFields,
  mergeLocalized,
} from '@/features/assist/use-form-fill'

interface BranchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch: BranchResponse | null
}

export function BranchDialog({
  open,
  onOpenChange,
  branch,
}: BranchDialogProps) {
  const t = useT()
  const isEditing = !!branch
  // The form owns its fields; its "Fill in with AI" is drawn into the header
  const [fillSlot, setFillSlot] = useState<HTMLElement | null>(null)

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('editBranch') : t('createBranch')}
      headerAction={<div ref={setFillSlot} className='contents' />}
    >
      {/* Keyed so form state resets per branch; closing unmounts it */}
      <BranchForm
        key={String(branch?.id ?? 'new')}
        branch={branch}
        onOpenChange={onOpenChange}
        fillSlot={fillSlot}
      />
    </EntitySheet>
  )
}

function BranchForm({
  branch,
  onOpenChange,
  fillSlot,
}: {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
  /** Where the sheet's header takes the form's "Fill in with AI" */
  fillSlot: HTMLElement | null
}) {
  const t = useT()
  const cloudKitchen = useIsCloudKitchen()
  const queryClient = useQueryClient()
  const isEditing = !!branch

  const [form, setForm] = useState({
    name: toLocalizedValue(branch?.name),
    addressEn: branch?.address?.en ?? '',
    addressAr: branch?.address?.ar ?? '',
    phone: branch?.phone ?? '',
    taxNumber: branch?.taxNumber ?? '',
    receiptFooter: toLocalizedValue(branch?.receiptFooter),
    // When the day turns over, not when the branch opens: early morning, when nothing is sold
    dayStartTime: branch?.dayStartTime?.slice(0, 5) ?? '06:00',
    isActive: branch?.isActive ?? true,
    requireSignInForTableOrders: branch?.requireSignInForTableOrders ?? false,
  })
  const [error, setError] = useState('')

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getAllBranches' }] })
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
    toast.success(
      isEditing ? t('branchUpdatedSuccess') : t('branchCreatedSuccess')
    )
    onOpenChange(false)
  }

  const createBranch = useMutation({
    ...createBranchMutation(),
    onSuccess,
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  const updateBranch = useMutation({
    ...updateBranchMutation(),
    onSuccess,
    onError: () => toast.error(t('failedToSaveBranch')),
  })

  const isSaving = createBranch.isPending || updateBranch.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlank(form.name)) {
      setError(t('nameIsRequired'))
      return
    }
    setError('')

    const name = fromLocalizedValue(form.name)
    const address =
      form.addressEn.trim() || form.addressAr.trim()
        ? {
            en: form.addressEn.trim(),
            ar: form.addressAr.trim() || null,
          }
        : null
    const phone = form.phone.trim() || null
    const taxNumber = form.taxNumber.trim() || null
    const receiptFooter =
      form.receiptFooter.en.trim() || form.receiptFooter.ar.trim()
        ? fromLocalizedValue(form.receiptFooter)
        : null
    const dayStartTime = `${form.dayStartTime}:00`

    if (isEditing) {
      updateBranch.mutate({
        path: { id: Number(branch.id) },
        body: {
          name,
          address,
          phone,
          taxNumber,
          receiptFooter,
          isActive: form.isActive,
          displayOrder: branch.displayOrder,
          dayStartTime,
          isOrderingEnabled: branch.isOrderingEnabled,
          isReservationsEnabled: branch.isReservationsEnabled,
          requireSignInForTableOrders: form.requireSignInForTableOrders,
        },
      })
    } else {
      createBranch.mutate({
        body: {
          name,
          address,
          phone,
          taxNumber,
          receiptFooter,
          dayStartTime,
        },
      })
    }
  }

  return (
    <form id='branch-form' onSubmit={handleSubmit} className='space-y-4'>
      {/* The other language of its name, address and receipt footer; never
          a phone, a tax number or a time */}
      {fillSlot &&
        createPortal(
          <FormFillButton
            form='a branch of a caf� or restaurant'
            fields={[
              ...localizedFields('name', 'Name', form.name),
              {
                key: 'address.en',
                label: 'Address (English)',
                type: 'text',
                value: form.addressEn,
                language: 'en',
              },
              {
                key: 'address.ar',
                label: 'Address (Arabic)',
                type: 'text',
                value: form.addressAr,
                language: 'ar',
              },
              ...localizedFields(
                'receiptFooter',
                'Line at the foot of the receipt',
                form.receiptFooter
              ),
            ]}
            onFilled={(filled) =>
              setForm((prev) => ({
                ...prev,
                name: mergeLocalized('name', prev.name, filled),
                addressEn: prev.addressEn.trim()
                  ? prev.addressEn
                  : (filled['address.en'] ?? prev.addressEn),
                addressAr: prev.addressAr.trim()
                  ? prev.addressAr
                  : (filled['address.ar'] ?? prev.addressAr),
                receiptFooter: mergeLocalized(
                  'receiptFooter',
                  prev.receiptFooter,
                  filled
                ),
              }))
            }
          />,
          fillSlot
        )}
      <LocalizedInput
        id='branch-name'
        label={t('name')}
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
        error={error ?? undefined}
        autoFocus
      />

      <FieldGrid>
        <Field label={t('addressEnglish')} htmlFor='branchAddressEn'>
          <Input
            id='branchAddressEn'
            value={form.addressEn}
            onChange={(e) => setForm({ ...form, addressEn: e.target.value })}
          />
        </Field>
        <Field label={t('addressArabic')} htmlFor='branchAddressAr'>
          <Input
            id='branchAddressAr'
            dir='rtl'
            value={form.addressAr}
            onChange={(e) => setForm({ ...form, addressAr: e.target.value })}
          />
        </Field>
      </FieldGrid>

      <Field label={t('branchPhone')} htmlFor='branchPhone'>
        <Input
          id='branchPhone'
          type='tel'
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </Field>

      <Field label={t('taxNumber')} htmlFor='branchTaxNumber'>
        <Input
          id='branchTaxNumber'
          value={form.taxNumber}
          onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
        />
      </Field>

      <LocalizedInput
        id='branch-receipt-footer'
        label={t('receiptFooter')}
        value={form.receiptFooter}
        onChange={(receiptFooter) => setForm({ ...form, receiptFooter })}
      />

      {/* One time, when the day turns over: a day runs from it round to it, so nothing falls outside one */}
      <Field
        label={t('dayStartTime')}
        htmlFor='dayStart'
        hint={t('dayStartTimeHint')}
      >
        <Input
          id='dayStart'
          type='time'
          className='w-32'
          value={form.dayStartTime}
          onChange={(e) => setForm({ ...form, dayStartTime: e.target.value })}
        />
      </Field>

      {isEditing && (
        <SwitchGroup>
          <SwitchRow
            title={t('branchActive')}
            checked={form.isActive}
            onCheckedChange={(checked) =>
              setForm({ ...form, isActive: checked })
            }
          />
          {/* Off by default; on when strangers with a table's link become a
              problem — a guest may still browse, but a table order needs an
              account the branch can hold to. A cloud kitchen has no tables */}
          {!cloudKitchen && (
            <SwitchRow
              title={t('requireSignInForTableOrders')}
              checked={form.requireSignInForTableOrders}
              onCheckedChange={(checked) =>
                setForm({ ...form, requireSignInForTableOrders: checked })
              }
            />
          )}
        </SwitchGroup>
      )}

      <SheetActions>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' form='branch-form' disabled={isSaving}>
          {isSaving && <Spinner />}
          {isEditing ? t('save') : t('create')}
        </Button>
      </SheetActions>
    </form>
  )
}
