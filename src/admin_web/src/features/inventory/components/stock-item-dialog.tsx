import { useState } from 'react'
import { type StockItemView } from '@/api/inventory'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import {
  fromLocalizedValue,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-[520px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t('editStockItem') : t('addStockItem')}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('editStockItemDescription')
              : t('addStockItemDescription')}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so form state resets per item; closing unmounts and resets */}
        <StockItemForm
          key={String(item?.id ?? 'new')}
          item={item}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  )
}

type FormState = {
  name: LocalizedValue
  unitChoice: string
  customUnit: string
  packSize: string
  packName: string
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
    packName: item?.packName ?? '',
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
    if (!form.name.en.trim()) nextErrors.name = t('englishNameRequired')
    if (!unit) nextErrors.unit = t('unitRequired')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const packSize = form.packSize ? parseFloat(form.packSize) : NaN
    const body = {
      name: fromLocalizedValue(form.name),
      unit,
      packSize: packSize > 0 ? packSize : null,
      packName:
        packSize > 0 && form.packName.trim() ? form.packName.trim() : null,
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
      <form onSubmit={handleSubmit} className='space-y-4'>
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

        <div className='grid grid-cols-2 gap-4'>
          <div className='space-y-2'>
            <Label htmlFor='unit'>{t('unit')}</Label>
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
            {errors.unit && (
              <p className='text-destructive text-sm'>{errors.unit}</p>
            )}
          </div>
          {form.unitChoice === CUSTOM_UNIT && (
            <div className='space-y-2'>
              <Label htmlFor='customUnit'>{t('unitOther')}</Label>
              <Input
                id='customUnit'
                placeholder={t('unitCustomPlaceholder')}
                value={form.customUnit}
                onChange={(e) =>
                  setForm({ ...form, customUnit: e.target.value })
                }
              />
            </div>
          )}
        </div>

        <div className='space-y-3 rounded-lg border p-3'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='packSize'>{t('packSize')}</Label>
              <Input
                id='packSize'
                type='number'
                min='0'
                step='any'
                placeholder={t('optional')}
                value={form.packSize}
                onChange={(e) => setForm({ ...form, packSize: e.target.value })}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='packName'>{t('packName')}</Label>
              <Input
                id='packName'
                placeholder={t('packNameHint')}
                value={form.packName}
                disabled={!form.packSize}
                onChange={(e) => setForm({ ...form, packName: e.target.value })}
              />
            </div>
          </div>
          <p className='text-muted-foreground text-xs'>{t('packHint')}</p>
        </div>

        <div className='flex items-center justify-between rounded-lg border p-3'>
          <div className='space-y-0.5 pe-4'>
            <Label className='text-sm'>{t('autoSoldOut')}</Label>
            <p className='text-muted-foreground text-xs'>
              {t('autoSoldOutHint')}
            </p>
          </div>
          <Switch
            checked={form.autoSoldOut}
            onCheckedChange={(checked) =>
              setForm({ ...form, autoSoldOut: checked })
            }
          />
        </div>

        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
          >
            {t('cancel')}
          </Button>
          <Button type='submit' disabled={isPending}>
            {isPending && <Spinner className='me-2' />}
            {t('save')}
          </Button>
        </DialogFooter>
      </form>
    </LocalizedFields>
  )
}
