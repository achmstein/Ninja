import { useState } from 'react'
import { type StockItemView } from '@/api/inventory'
import { bilingual, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
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
import { EntitySheet, SheetActions } from '@/components/entity-sheet'
import { Field, FieldGrid, SwitchRow } from '@/components/field'
import {
  fromLocalizedValue,
  isBlank,
  LocalizedFields,
  LocalizedInput,
  toLocalizedValue,
  type LocalizedValue,
} from '@/components/localized-input'
import { LOCALIZE_STOCK_ITEM } from '@/features/assist/use-localize-assist'
import { useNameAssist } from '@/features/assist/use-name-assist'
import { CUSTOM_UNIT, UNITS, unitLabel } from '../format'
import { useInventoryActions } from '../use-inventory-actions'

interface StockItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: StockItemView | null
}

export function StockItemDialog({
  open,
  onOpenChange,
  item,
}: StockItemDialogProps) {
  const t = useT()
  const isEditing = !!item

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('editStockItem') : t('addStockItem')}
    >
      {/* Keyed so form state resets per item; closing unmounts and resets */}
      <StockItemForm
        key={String(item?.id ?? 'new')}
        item={item}
        onOpenChange={onOpenChange}
      />
    </EntitySheet>
  )
}

type FormState = {
  name: LocalizedValue
  unitChoice: string
  customUnit: string
  packSize: string
  packName: LocalizedValue
  autoSoldOut: boolean
}

function StockItemForm({
  item,
  onOpenChange,
}: {
  item: StockItemView | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const { createItem, updateItem, isPending } = useInventoryActions()
  const knownUnit = (UNITS as readonly string[]).includes(item?.unit ?? '')

  const [form, setForm] = useState<FormState>({
    name: toLocalizedValue(item?.name),
    unitChoice: item ? (knownUnit ? item.unit : CUSTOM_UNIT) : 'pcs',
    customUnit: item && !knownUnit ? item.unit : '',
    packSize: item?.packSize != null ? String(toNumber(item.packSize)) : '',
    packName: toLocalizedValue(item?.packName),
    autoSoldOut: item?.autoSoldOut ?? false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameAssist = useNameAssist(LOCALIZE_STOCK_ITEM, form.name, (update) =>
    setForm((prev) => ({ ...prev, name: update(prev.name) }))
  )

  const unit =
    form.unitChoice === CUSTOM_UNIT ? form.customUnit.trim() : form.unitChoice

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (isBlank(form.name)) nextErrors.name = t('nameIsRequired')
    if (!unit) nextErrors.unit = t('unitRequired')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const packSize = form.packSize ? parseFloat(form.packSize) : NaN
    const body = {
      name: fromLocalizedValue(form.name),
      unit,
      packSize: packSize > 0 ? packSize : null,
      packName:
        packSize > 0 && !isBlank(form.packName)
          ? fromLocalizedValue(form.packName)
          : null,
      autoSoldOut: form.autoSoldOut,
      // Retire/restore are actions on the panel, not a field here
      isActive: item?.isActive,
    }
    try {
      if (item) {
        await updateItem(toNumber(item.id), body)
      } else {
        await createItem(body)
      }
      onOpenChange(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <LocalizedFields lang={nameAssist.lang} onLangChange={nameAssist.setLang}>
      <form id='stock-item-form' onSubmit={handleSubmit} className='space-y-4'>
        <LocalizedInput
          id='stock-item-name'
          label={t('name')}
          value={form.name}
          onChange={nameAssist.onChange}
          error={errors.name}
          autoFocus
          assist={nameAssist.slot}
          suggested={nameAssist.suggested}
        />

        <FieldGrid>
          <Field label={t('unit')} htmlFor='unit' error={errors.unit}>
            <Select
              value={form.unitChoice}
              onValueChange={(value) => setForm({ ...form, unitChoice: value })}
            >
              <SelectTrigger id='unit'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {unitLabel(value, t)}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_UNIT}>{t('unitOther')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {form.unitChoice === CUSTOM_UNIT && (
            <Field label={t('unitOther')} htmlFor='customUnit'>
              <Input
                id='customUnit'
                placeholder={t('unitCustomPlaceholder')}
                value={form.customUnit}
                onChange={(e) =>
                  setForm({ ...form, customUnit: e.target.value })
                }
              />
            </Field>
          )}
        </FieldGrid>

        <div className='space-y-3 rounded-lg border p-3'>
          <FieldGrid>
            <Field label={t('packSize')} htmlFor='packSize'>
              <Input
                id='packSize'
                type='number'
                min='0'
                step='any'
                placeholder={t('optional')}
                value={form.packSize}
                onChange={(e) => setForm({ ...form, packSize: e.target.value })}
              />
            </Field>
            <LocalizedInput
              id='packName'
              label={t('packName')}
              placeholder={bilingual('packNameHint')}
              value={form.packName}
              disabled={!form.packSize}
              onChange={(packName) => setForm({ ...form, packName })}
            />
          </FieldGrid>
        </div>

        <SwitchRow
          title={t('autoSoldOut')}
          description={t('autoSoldOutHint')}
          checked={form.autoSoldOut}
          onCheckedChange={(checked) =>
            setForm({ ...form, autoSoldOut: checked })
          }
        />

        <SheetActions>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button type='submit' form='stock-item-form' disabled={isPending}>
            {isPending && <Spinner />}
            {t('save')}
          </Button>
        </SheetActions>
      </form>
    </LocalizedFields>
  )
}
