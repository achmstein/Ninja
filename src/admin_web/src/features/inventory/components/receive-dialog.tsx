import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { type StockItemView } from '@/api/inventory'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
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
import { Spinner } from '@/components/ui/spinner'
import { Combobox } from '@/components/combobox'
import { unitLabel } from '../format'
import { stockItemsQueryOptions, toStockItemOptions } from '../queries'
import { useInventoryActions } from '../use-inventory-actions'

interface ReceiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Starts the invoice with this item on the first line (opened from its panel) */
  stockItemId?: number | null
}

export function ReceiveDialog({
  open,
  onOpenChange,
  stockItemId,
}: ReceiveDialogProps) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-[760px]'>
        <DialogHeader>
          <DialogTitle>{t('receiveStock')}</DialogTitle>
          <DialogDescription>{t('receiveStockDescription')}</DialogDescription>
        </DialogHeader>
        {open && (
          <ReceiveForm
            onOpenChange={onOpenChange}
            initialStockItemId={stockItemId ?? null}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type Line = {
  key: number
  stockItemId: string | null
  /** Base-unit quantity, what is actually posted */
  quantity: string
  /** Pack count the user typed, only for items with a pack size */
  packs: string
  unitCost: string
  /** Line total as typed or derived; the invoice usually shows this, not the unit cost */
  total: string
  /** Which of the two the user typed last: the other one is derived from it */
  priced: 'unit' | 'total'
}

let lineKey = 0
const newLine = (): Line => ({
  key: lineKey++,
  stockItemId: null,
  quantity: '',
  packs: '',
  unitCost: '',
  total: '',
  priced: 'unit',
})

const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '')
const perUnit = (n: number) =>
  Number.isFinite(n) ? String(Math.round(n * 10000) / 10000) : ''

/**
 * Keep quantity, unit cost and total consistent whichever one changed:
 * typing the invoice total gives the unit cost, typing a unit cost gives the
 * total, and a new quantity re-derives whichever the user did not type.
 */
function reprice(line: Line, patch: Partial<Line>): Partial<Line> {
  const next = { ...line, ...patch }
  const qty = parseFloat(next.quantity)

  if ('total' in patch) {
    const total = parseFloat(next.total)
    return {
      ...patch,
      priced: 'total',
      unitCost: qty > 0 && total >= 0 ? perUnit(total / qty) : next.unitCost,
    }
  }

  if ('unitCost' in patch) {
    const cost = parseFloat(next.unitCost)
    return {
      ...patch,
      priced: 'unit',
      total: qty > 0 && cost >= 0 ? money(qty * cost) : '',
    }
  }

  // Quantity (or packs) changed: hold what was typed, derive the other
  if (next.priced === 'total') {
    const total = parseFloat(next.total)
    return {
      ...patch,
      unitCost: qty > 0 && total >= 0 ? perUnit(total / qty) : '',
    }
  }

  const cost = parseFloat(next.unitCost)
  return { ...patch, total: qty > 0 && cost >= 0 ? money(qty * cost) : '' }
}

/** Column template shared by the header row and every line */
const LINE_GRID =
  'sm:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] sm:gap-2 sm:items-center'

function ReceiveForm({
  onOpenChange,
  initialStockItemId,
}: {
  onOpenChange: (open: boolean) => void
  initialStockItemId: number | null
}) {
  const t = useT()
  const { receivePurchase, isPending } = useInventoryActions()
  const { data: items = [] } = useQuery(stockItemsQueryOptions())
  const itemById = new Map(items.map((item) => [String(item.id), item]))

  const [supplier, setSupplier] = useState('')
  const [invoiceRef, setInvoiceRef] = useState('')
  const [lines, setLines] = useState<Line[]>(() => [
    {
      ...newLine(),
      stockItemId:
        initialStockItemId != null ? String(initialStockItemId) : null,
    },
  ])

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, ...reprice(line, patch) } : line
      )
    )

  const grandTotal = lines.reduce(
    (sum, line) => sum + (parseFloat(line.total) || 0),
    0
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.length === 0) {
      toast.error(t('purchaseNeedsLine'))
      return
    }
    const complete = lines.every(
      (line) =>
        line.stockItemId &&
        parseFloat(line.quantity) > 0 &&
        parseFloat(line.unitCost) >= 0 &&
        line.unitCost !== ''
    )
    if (!complete) {
      toast.error(t('purchaseLineIncomplete'))
      return
    }
    try {
      await receivePurchase({
        supplier: supplier.trim() || null,
        invoiceRef: invoiceRef.trim() || null,
        lines: lines.map((line) => ({
          stockItemId: Number(line.stockItemId),
          quantity: parseFloat(line.quantity),
          unitCost: parseFloat(line.unitCost),
        })),
      })
      onOpenChange(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid grid-cols-2 gap-4'>
        <div className='space-y-2'>
          <Label htmlFor='supplier'>{t('supplier')}</Label>
          <Input
            id='supplier'
            placeholder={t('supplierPlaceholder')}
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            autoFocus
          />
        </div>
        <div className='space-y-2'>
          <Label htmlFor='invoiceRef'>{t('invoiceRef')}</Label>
          <Input
            id='invoiceRef'
            placeholder={t('invoiceRefPlaceholder')}
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
          />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>{t('lines')}</Label>
        {/* One list, not a card per line: a header row names the columns on
            wide screens; on a phone each field carries its own small label */}
        <div className='rounded-lg border'>
          <div
            className={`text-muted-foreground hidden border-b px-3 py-2 text-xs sm:grid ${LINE_GRID}`}
          >
            <span>{t('stockItem')}</span>
            <span>{t('quantity')}</span>
            <span>{t('unitCost')}</span>
            <span className='text-end'>{t('total')}</span>
            <span className='w-9' />
          </div>
          <div className='divide-y'>
            {lines.map((line) => (
              <ReceiveLine
                key={line.key}
                line={line}
                item={
                  line.stockItemId ? itemById.get(line.stockItemId) : undefined
                }
                items={items}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() =>
                  setLines((prev) => prev.filter((l) => l.key !== line.key))
                }
              />
            ))}
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => setLines((prev) => [...prev, newLine()])}
        >
          <Plus className='me-1 h-4 w-4' />
          {t('addLine')}
        </Button>
      </div>

      <div className='flex items-center justify-between rounded-lg border px-3 py-2'>
        <span className='text-sm font-medium'>{t('grandTotal')}</span>
        <span className='font-semibold tabular-nums'>
          {formatEgp(grandTotal)}
        </span>
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
          {t('receiveStock')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ReceiveLine({
  line,
  item,
  items,
  onChange,
  onRemove,
}: {
  line: Line
  item: StockItemView | undefined
  items: StockItemView[]
  onChange: (patch: Partial<Line>) => void
  onRemove: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const packSize = toNumber(item?.packSize)
  const hasPack = packSize > 0

  return (
    <div className='space-y-1.5 px-3 py-2'>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${LINE_GRID}`}>
        <Combobox
          value={line.stockItemId}
          onChange={(value) => {
            const next = value
              ? items.find((i) => String(i.id) === value)
              : undefined
            // A different pack size makes the typed pack count meaningless
            onChange({
              stockItemId: value,
              packs: toNumber(next?.packSize) > 0 ? line.packs : '',
            })
          }}
          options={toStockItemOptions(items, localized, t)}
          placeholder={t('pickStockItem')}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-9 sm:order-last'
          aria-label={t('removeLine')}
          onClick={onRemove}
        >
          <X className='h-4 w-4' />
        </Button>
        {hasPack ? (
          <LabeledInput label={t('packs')}>
            <Input
              type='number'
              min='0'
              step='any'
              placeholder='0'
              aria-label={t('packs')}
              value={line.packs}
              onChange={(e) => {
                const packs = parseFloat(e.target.value)
                onChange({
                  packs: e.target.value,
                  quantity: packs > 0 ? String(packs * packSize) : '',
                })
              }}
            />
          </LabeledInput>
        ) : (
          <LabeledInput
            label={
              item
                ? `${t('quantity')} (${unitLabel(item.unit, t)})`
                : t('quantity')
            }
          >
            <Input
              type='number'
              min='0'
              step='any'
              placeholder='0'
              aria-label={t('quantity')}
              value={line.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
            />
          </LabeledInput>
        )}
        <LabeledInput
          label={`${t('unitCost')}${item ? ` / ${unitLabel(item.unit, t)}` : ''}`}
        >
          <Input
            type='number'
            min='0'
            step='0.01'
            placeholder='0.00'
            aria-label={t('unitCost')}
            value={line.unitCost}
            onChange={(e) => onChange({ unitCost: e.target.value })}
          />
        </LabeledInput>
        <LabeledInput label={t('total')}>
          <Input
            type='number'
            min='0'
            step='0.01'
            placeholder='0.00'
            aria-label={t('total')}
            className='text-end tabular-nums'
            value={line.total}
            onChange={(e) => onChange({ total: e.target.value })}
          />
        </LabeledInput>
      </div>
      {hasPack && item && (
        <p className='text-muted-foreground text-xs'>
          ×{' '}
          {t('packOf', {
            packName: item.packName || t('pack'),
            packSize,
            unit: unitLabel(item.unit, t),
          })}
          {line.quantity &&
            ` = ${toNumber(line.quantity)} ${unitLabel(item.unit, t)}`}
        </p>
      )}
    </div>
  )
}

/**
 * A field with its label above it on a phone, where the columns stack and a
 * bare number box would mean nothing. On a wide screen the header row names
 * the columns and the label is hidden.
 */
function LabeledInput({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1'>
      <span className='text-muted-foreground block truncate text-xs sm:hidden'>
        {label}
      </span>
      {children}
    </div>
  )
}
