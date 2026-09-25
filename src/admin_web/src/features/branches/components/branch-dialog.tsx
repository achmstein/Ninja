import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type BranchResponse } from '@/api/branch'
import {
  createBranchMutation,
  updateBranchMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { useIsCloudKitchen } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
  LocalizedInput,
  toLocalizedValue,
} from '@/components/localized-input'

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editBranch') : t('createBranch')}
          </DialogTitle>
        </DialogHeader>
        {/* Keyed so form state resets per branch; closing unmounts it */}
        <BranchForm
          key={String(branch?.id ?? 'new')}
          branch={branch}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

function BranchForm({
  branch,
  onOpenChange,
}: {
  branch: BranchResponse | null
  onOpenChange: (open: boolean) => void
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
    dayStartTime: branch?.dayStartTime?.slice(0, 5) ?? '10:00',
    dayEndTime: branch?.dayEndTime?.slice(0, 5) ?? '02:00',
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
    if (!form.name.en.trim()) {
      setError(t('englishNameRequired'))
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
    const dayEndTime = `${form.dayEndTime}:00`

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
          dayEndTime,
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
          dayEndTime,
        },
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <LocalizedInput
        id='branch-name'
        label={t('name')}
        value={form.name}
        onChange={(name) => setForm({ ...form, name })}
        error={error ?? undefined}
        autoFocus
      />

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='branchAddressEn'>{t('addressEnglish')}</Label>
          <Input
            id='branchAddressEn'
            value={form.addressEn}
            onChange={(e) => setForm({ ...form, addressEn: e.target.value })}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='branchAddressAr'>{t('addressArabic')}</Label>
          <Input
            id='branchAddressAr'
            dir='rtl'
            value={form.addressAr}
            onChange={(e) => setForm({ ...form, addressAr: e.target.value })}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label htmlFor='branchPhone'>{t('branchPhone')}</Label>
        <Input
          id='branchPhone'
          type='tel'
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>

      <div className='space-y-2'>
        <Label htmlFor='branchTaxNumber'>{t('taxNumber')}</Label>
        <Input
          id='branchTaxNumber'
          value={form.taxNumber}
          onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
        />
      </div>

      <LocalizedInput
        id='branch-receipt-footer'
        label={t('receiptFooter')}
        value={form.receiptFooter}
        onChange={(receiptFooter) => setForm({ ...form, receiptFooter })}
      />

      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='dayStart'>{t('dayStartTime')}</Label>
          <Input
            id='dayStart'
            type='time'
            value={form.dayStartTime}
            onChange={(e) => setForm({ ...form, dayStartTime: e.target.value })}
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='dayEnd'>{t('dayEndTime')}</Label>
          <Input
            id='dayEnd'
            type='time'
            value={form.dayEndTime}
            onChange={(e) => setForm({ ...form, dayEndTime: e.target.value })}
          />
        </div>
      </div>

      {isEditing && (
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <Label className='text-sm'>{t('branchActive')}</Label>
          <Switch
            checked={form.isActive}
            onCheckedChange={(checked) =>
              setForm({ ...form, isActive: checked })
            }
          />
        </div>
      )}

      {/* Off by default; on when strangers with a table's link become a
          problem — a guest may still browse, but a table order needs an
          account the branch can hold to. A cloud kitchen has no tables */}
      {isEditing && !cloudKitchen && (
        <div className='flex items-center justify-between rounded-lg border p-3'>
          <Label className='text-sm'>{t('requireSignInForTableOrders')}</Label>
          <Switch
            checked={form.requireSignInForTableOrders}
            onCheckedChange={(checked) =>
              setForm({ ...form, requireSignInForTableOrders: checked })
            }
          />
        </div>
      )}

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={isSaving}>
          {isSaving && <Spinner className='me-2' />}
          {isEditing ? t('update') : t('create')}
        </Button>
      </DialogFooter>
    </form>
  )
}
