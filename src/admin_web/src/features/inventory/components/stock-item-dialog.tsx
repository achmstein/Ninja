import { useState } from 'react'
import { createPortal } from 'react-dom'
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
  type Lang,
  type LocalizedValue,
} from '@/components/localized-input'
import { FormFillButton } from '@/features/assist/form-fill-button'
import {
  localizedFields,
  mergeLocalized,
  type FillField,
} from '@/features/assist/use-form-fill'
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
  // The form owns its fields; its "Fill in with AI" is drawn into the header
  const [fillSlot, setFillSlot] = useState<HTMLElement | null>(null)

  return (
    <EntitySheet
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t('editStockItem') : t('addStockItem')}
      headerAction={<div ref={setFillSlot} className='contents' />}
    >
      {/* Keyed so form state resets per item; closing unmounts and resets */}
      <StockItemForm
        key={String(item?.id ?? 'new')}
        item={item}
        onOpenChange={onOpenChange}
        fillSlot={fillSlot}
      />
    </EntitySheet>
  )
}

// The units as the assistant reads them
const UNIT_NAMES: Record<(typeof UNITS)[number], string> = {
  pcs: 'pieces',
  g: 'grams',
  ml: 'millilitres',
  kg: 'kilograms',
  l: 'litres',
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
  fillSlot,
}: {
  item: StockItemView | null
  onOpenChange: (open: boolean) => void
  /** Where the sheet's header takes the form's "Fill in with AI" */
  fillSlot: HTMLElement | null
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
  // A new item's unit starts as pieces; until it is picked, the assistant
  // may pick the fitting one from the name
  const [unitPicked, setUnitPicked] = useState(!!item)
  /** Name languages "Fill in with AI" wrote and nobody has edited since */
  const [nameFilled, setNameFilled] = useState<Partial<Record<Lang, boolean>>>(
    {}
  )

  const fillFields: FillField[] = [
    ...localizedFields('name', 'Name', form.name),
    {
      key: 'unit',
      label: 'Unit it is counted in',
      type: 'choice',
      value: unitPicked ? form.unitChoice : null,
      options: UNITS.map((value) => ({ value, label: UNIT_NAMES[value] })),
    },
    ...(form.unitChoice === CUSTOM_UNIT
      ? [
          {
            key: 'customUnit',
            label: 'Unit it is counted in',
            type: 'text' as const,
            value: form.customUnit,
          },
        ]
      : []),
    // The pack's name only once there is a pack: its size is never guessed
    ...(form.packSize
      ? localizedFields('packName', 'What a pack is called', form.packName)
      : []),
  ]

  const applyFill = (filled: Record<string, string>) => {
    const name = mergeLocalized('name', form.name, filled)
    const wrote = (['en', 'ar'] as const).filter(
      (lang) => name[lang] !== form.name[lang]
    )
    const unit = filled.unit
    setForm((prev) => ({
      ...prev,
      name: mergeLocalized('name', prev.name, filled),
      unitChoice:
        !unitPicked && unit && (UNITS as readonly string[]).includes(unit)
          ? unit
          : prev.unitChoice,
      customUnit: prev.customUnit.trim()
        ? prev.customUnit
        : (filled.customUnit ?? prev.customUnit),
      packName: mergeLocalized('packName', prev.packName, filled),
    }))
    if (unit) setUnitPicked(true)
    if (wrote.length > 0) {
      setNameFilled((prev) => ({
        ...prev,
        ...Object.fromEntries(wrote.map((lang) => [lang, true])),
      }))
      nameAssist.setLang(wrote[0])
    }
  }

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
        {fillSlot &&
          createPortal(
            <FormFillButton
              form='a stock item (an ingredient or supply a café keeps)'
              fields={fillFields}
              onFilled={applyFill}
            />,
            fillSlot
          )}
        <LocalizedInput
          id='stock-item-name'
          label={t('name')}
          value={form.name}
          onChange={(value, lang) => {
            nameAssist.onChange(value, lang)
            setNameFilled((prev) => ({ ...prev, [lang]: false }))
          }}
          error={errors.name}
          autoFocus
          assist={nameAssist.slot}
          suggested={{
            en: nameAssist.suggested.en || nameFilled.en,
            ar: nameAssist.suggested.ar || nameFilled.ar,
          }}
        />

        <FieldGrid>
          <Field label={t('unit')} htmlFor='unit' error={errors.unit}>
            <Select
              value={form.unitChoice}
              onValueChange={(value) => {
                setForm({ ...form, unitChoice: value })
                setUnitPicked(true)
              }}
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
