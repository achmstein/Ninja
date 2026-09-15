import { useState } from 'react'
import { AlertTriangle, Sparkles } from 'lucide-react'
import { type SupplierView } from '@/api/finance'
import { type ReceiptProposal, type StockItemView } from '@/api/inventory'
import { bestMatch } from '@/lib/fuzzy'
import { useLocalized, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { LocalizedInput } from '@/components/localized-input'
import { UNITS, unitLabel } from '../format'
import { type Amounts, type Line, reprice } from '../lines'
import { toStockItemOptions } from '../queries'
import {
  confidenceLevel,
  isReviewLineReady,
  matchedItem,
  type ReviewLine,
  toReceiveLine,
  toReviewLines,
} from '../receipt-scan'
import { useInventoryActions } from '../use-inventory-actions'
import { useLastCosts } from '../use-last-costs'
import { CostHint, LineAmounts, PackHint } from './line-amounts'

type ReviewResult = {
  supplierId: string | null
  invoiceRef: string
  lines: Line[]
}

type ReceiptReviewSheetProps = {
  proposal: ReceiptProposal
  items: StockItemView[]
  suppliers: SupplierView[]
  onOpenChange: (open: boolean) => void
  /** The reviewed lines, every one pointing at an existing stock item */
  onConfirm: (result: ReviewResult) => void
}

/**
 * What the assistant read, laid out for checking line by line: match each
 * line to a stock item (its guess first, the look-alikes next) or create
 * the item it proposed, correct the numbers, untick what is not stock.
 * Confirming creates the new items one by one and hands the lines to the
 * receive form; nothing is posted until the user presses Receive there.
 */
export function ReceiptReviewSheet({
  proposal,
  items,
  suppliers,
  onOpenChange,
  onConfirm,
}: ReceiptReviewSheetProps) {
  const t = useT()
  const { createItem } = useInventoryActions()
  const itemById = new Map(items.map((item) => [String(item.id), item]))
  const lastCosts = useLastCosts()

  const matchedSupplier = bestMatch(proposal.supplier, suppliers, (s) => s.name)
  const [supplierId, setSupplierId] = useState<string | null>(
    matchedSupplier ? String(matchedSupplier.id) : null
  )
  const [invoiceRef, setInvoiceRef] = useState(proposal.invoiceRef ?? '')
  const [lines, setLines] = useState<ReviewLine[]>(() =>
    toReviewLines(proposal)
  )
  const [creating, setCreating] = useState<{
    done: number
    total: number
  } | null>(null)

  const updateLine = (key: number, patch: Partial<ReviewLine>) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )

  const updateAmounts = (key: number, patch: Partial<Amounts>) =>
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, ...reprice(line, patch) } : line
      )
    )

  const included = lines.filter((line) => line.include)
  const computedTotal = included.reduce(
    (sum, line) => sum + (parseFloat(line.total) || 0),
    0
  )
  const printedTotal =
    proposal.printedTotal != null ? toNumber(proposal.printedTotal) : null
  const totalsDiffer =
    printedTotal != null && Math.abs(printedTotal - computedTotal) > 0.05
  const allReady = included.every(isReviewLineReady)

  const confirm = async () => {
    if (included.length === 0) {
      toast.error(t('noLinesSelected'))
      return
    }
    if (!allReady) {
      toast.error(t('lineNeedsItem'))
      return
    }

    // New items are created one at a time; a line that got its id keeps it,
    // so a retry after a failure never creates the same item twice
    const toCreate = included.filter(
      (line) => !line.stockItemId && line.newItem && line.createdId == null
    )
    const ids = new Map<number, number>()
    for (const line of included) {
      if (line.stockItemId) ids.set(line.key, Number(line.stockItemId))
      else if (line.createdId != null) ids.set(line.key, line.createdId)
    }

    setCreating({ done: 0, total: toCreate.length })
    try {
      for (const [index, line] of toCreate.entries()) {
        const draft = line.newItem!
        const packSize = parseFloat(draft.packSize)
        const created = await createItem({
          name: { en: draft.nameEn.trim(), ar: draft.nameAr.trim() || null },
          unit: draft.unit,
          packSize: packSize > 0 ? packSize : null,
          packName:
            packSize > 0 && draft.packName.trim()
              ? draft.packName.trim()
              : null,
          autoSoldOut: false,
        })
        const id = toNumber(created.id)
        ids.set(line.key, id)
        updateLine(line.key, {
          createdId: id,
          stockItemId: String(id),
          newItem: null,
        })
        setCreating({ done: index + 1, total: toCreate.length })
        toast.success(
          t('itemCreatedFromReceipt', { name: draft.nameEn.trim() })
        )
      }
    } catch {
      // toasted by useInventoryActions; the sheet stays open for a retry
      setCreating(null)
      return
    }
    setCreating(null)

    onConfirm({
      supplierId,
      invoiceRef: invoiceRef.trim(),
      lines: included.map((line) => toReceiveLine(line, ids.get(line.key)!)),
    })
  }

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl'>
        <SheetHeader className='border-b'>
          <SheetTitle className='flex items-center gap-2'>
            <Sparkles className='text-primary size-4' aria-hidden />
            {t('reviewScan')}
          </SheetTitle>
          <SheetDescription>{t('reviewScanDescription')}</SheetDescription>
        </SheetHeader>

        <div className='space-y-4 p-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label>{t('supplier')}</Label>
              <Combobox
                value={supplierId}
                onChange={setSupplierId}
                options={suppliers.map((s) => ({
                  value: String(s.id),
                  label: s.name,
                  hint: s.phone ?? undefined,
                }))}
                placeholder={t('noSupplier')}
                clearLabel={t('noSupplier')}
              />
              {proposal.supplier && (
                <p className='text-muted-foreground text-xs'>
                  {t('onTheReceipt', { text: proposal.supplier })}
                  {!matchedSupplier && ` — ${t('supplierNotFound')}`}
                </p>
              )}
            </div>
            <div className='space-y-2'>
              <Label htmlFor='scan-invoiceRef'>{t('invoiceRef')}</Label>
              <Input
                id='scan-invoiceRef'
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
              />
              {proposal.date && (
                <p className='text-muted-foreground text-xs'>
                  {t('onTheReceipt', { text: proposal.date })}
                </p>
              )}
            </div>
          </div>

          {(proposal.warnings.length > 0 || proposal.notes) && (
            <Alert>
              <AlertTriangle />
              <AlertTitle>{t('toastWarning')}</AlertTitle>
              <AlertDescription>
                <ul className='list-disc space-y-0.5 ps-4'>
                  {proposal.notes && <li>{proposal.notes}</li>}
                  {proposal.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className='space-y-3'>
            {lines.map((line) => (
              <ReviewLineCard
                key={line.key}
                line={line}
                item={matchedItem(line, itemById)}
                items={items}
                itemById={itemById}
                lastCost={
                  line.stockItemId
                    ? (lastCosts.get(toNumber(line.stockItemId)) ?? null)
                    : null
                }
                onChange={(patch) => updateLine(line.key, patch)}
                onAmounts={(patch) => updateAmounts(line.key, patch)}
              />
            ))}
          </div>

          <div className='space-y-1 rounded-lg border px-3 py-2'>
            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium'>{t('grandTotal')}</span>
              <span className='font-semibold tabular-nums'>
                {formatEgp(computedTotal)}
              </span>
            </div>
            {printedTotal != null && (
              <div
                className={cn(
                  'flex items-center justify-between text-xs',
                  totalsDiffer ? 'text-warning' : 'text-muted-foreground'
                )}
              >
                <span>{t('printedTotal')}</span>
                <span className='tabular-nums'>{formatEgp(printedTotal)}</span>
              </div>
            )}
            {totalsDiffer && (
              <p className='text-warning text-xs'>
                {t('totalsDiffer', {
                  computed: formatEgp(computedTotal),
                  printed: formatEgp(printedTotal),
                })}
              </p>
            )}
          </div>
        </div>

        <SheetFooter className='border-t sm:flex-row sm:justify-end'>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={creating != null}
          >
            {t('cancel')}
          </Button>
          <Button
            type='button'
            onClick={confirm}
            disabled={creating != null || included.length === 0 || !allReady}
          >
            {creating && <Spinner className='me-2' />}
            {creating
              ? t('creatingItems', creating)
              : t('addScannedLines', { count: included.length })}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

const confidenceKeys = {
  high: 'matchHigh',
  medium: 'matchMedium',
  low: 'matchLow',
  none: 'matchNone',
} as const

function ReviewLineCard({
  line,
  item,
  items,
  itemById,
  lastCost,
  onChange,
  onAmounts,
}: {
  line: ReviewLine
  item: StockItemView | undefined
  items: StockItemView[]
  itemById: Map<string, StockItemView>
  lastCost: number | null
  onChange: (patch: Partial<ReviewLine>) => void
  onAmounts: (patch: Partial<Amounts>) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const level = confidenceLevel(line)
  const creating = !line.stockItemId && line.newItem != null

  // The assistant's look-alikes first, marked, then everything else
  const suggestedIds = line.proposal.suggestions.map(String)
  const suggestedOptions: ComboboxOption[] = suggestedIds
    .map((id) => itemById.get(id))
    .filter((i): i is StockItemView => !!i)
    .map((i) => ({
      value: String(i.id),
      label: localized(i.name),
      hint: `${unitLabel(i.unit, t)} · ${t('suggestedMatch')}`,
    }))
  const options = [
    ...suggestedOptions,
    ...toStockItemOptions(
      items.filter((i) => !suggestedIds.includes(String(i.id))),
      localized,
      t
    ),
  ]

  // Pack size and unit come from the matched item, or from the draft
  const draftPackSize = parseFloat(line.newItem?.packSize ?? '')
  const unit = item?.unit ?? line.newItem?.unit
  const packSize = item
    ? toNumber(item.packSize)
    : draftPackSize > 0
      ? draftPackSize
      : 0

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-3',
        !line.include && 'opacity-60'
      )}
    >
      <div className='flex items-start gap-3'>
        <Checkbox
          checked={line.include}
          onCheckedChange={(checked) => onChange({ include: checked === true })}
          aria-label={t('includeLine')}
          className='mt-0.5'
        />
        <div className='min-w-0 flex-1 space-y-1'>
          <p className='text-sm font-medium break-words' dir='auto'>
            {line.proposal.rawText}
          </p>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant={level === 'high' ? 'default' : 'outline'}
              className={cn(
                level === 'medium' && 'border-warning text-warning',
                level === 'low' && 'border-destructive text-destructive'
              )}
            >
              {t(confidenceKeys[level])}
            </Badge>
            {!item && (
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto px-0 text-xs'
                onClick={() =>
                  onChange(
                    creating
                      ? { newItem: null }
                      : {
                          stockItemId: null,
                          newItem: {
                            nameEn:
                              line.proposal.newItem?.name.en ??
                              line.proposal.rawText,
                            nameAr: line.proposal.newItem?.name.ar ?? '',
                            unit: line.proposal.newItem?.unit ?? 'pcs',
                            packSize:
                              line.proposal.newItem?.packSize != null
                                ? String(
                                    toNumber(line.proposal.newItem.packSize)
                                  )
                                : '',
                            packName: line.proposal.newItem?.packName ?? '',
                          },
                        }
                  )
                }
              >
                {creating ? t('pickExistingItem') : t('createAsNewItem')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {line.include && (
        <div className='space-y-3 ps-7'>
          {creating && line.newItem ? (
            <NewItemFields
              draft={line.newItem}
              onChange={(draft) => onChange({ newItem: draft })}
            />
          ) : (
            <Combobox
              value={line.stockItemId}
              onChange={(value) => {
                const next = value ? itemById.get(value) : undefined
                // The receipt's pack count is kept; the quantity follows the
                // picked item's pack size (its unit cost follows the total)
                const nextPackSize = toNumber(next?.packSize)
                const packs = parseFloat(line.packs)
                onChange({
                  stockItemId: value,
                  newItem: null,
                  ...reprice(
                    line,
                    nextPackSize > 0 && packs > 0
                      ? {
                          packs: line.packs,
                          quantity: String(packs * nextPackSize),
                        }
                      : { packs: '' }
                  ),
                })
              }}
              options={options}
              placeholder={t('pickStockItem')}
            />
          )}

          <div className='grid grid-cols-3 gap-2'>
            <LineAmounts
              line={line}
              unit={unit}
              packSize={packSize}
              onChange={onAmounts}
              labelsAlways
            />
          </div>
          {unit && (
            <>
              <PackHint
                line={line}
                unit={unit}
                packSize={packSize}
                packName={item?.packName ?? line.newItem?.packName}
              />
              <CostHint line={line} unit={unit} lastCost={lastCost} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** The item the line will create: the assistant's draft, editable */
function NewItemFields({
  draft,
  onChange,
}: {
  draft: NonNullable<ReviewLine['newItem']>
  onChange: (draft: NonNullable<ReviewLine['newItem']>) => void
}) {
  const t = useT()
  const set = (patch: Partial<typeof draft>) => onChange({ ...draft, ...patch })

  return (
    <div className='bg-muted/40 space-y-2 rounded-md border p-2'>
      <p className='text-muted-foreground text-xs'>{t('newItemName')}</p>
      <LocalizedInput
        ariaLabel={t('newItemName')}
        value={{ en: draft.nameEn, ar: draft.nameAr }}
        onChange={(value) => set({ nameEn: value.en, nameAr: value.ar })}
        compact
      />
      <div className='grid grid-cols-3 gap-2'>
        <Select value={draft.unit} onValueChange={(unit) => set({ unit })}>
          <SelectTrigger aria-label={t('unit')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((value) => (
              <SelectItem key={value} value={value}>
                {unitLabel(value, t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type='number'
          min='0'
          step='any'
          aria-label={t('packSize')}
          placeholder={t('packSize')}
          value={draft.packSize}
          onChange={(e) => set({ packSize: e.target.value })}
        />
        <Input
          aria-label={t('packName')}
          placeholder={t('packName')}
          value={draft.packName}
          disabled={!draft.packSize}
          onChange={(e) => set({ packName: e.target.value })}
        />
      </div>
    </div>
  )
}
