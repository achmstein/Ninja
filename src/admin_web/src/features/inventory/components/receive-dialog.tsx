import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, ScanLine, X } from 'lucide-react'
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
import { suppliersQueryOptions } from '@/features/finance/queries'
import { isComplete, type Line, newLine, reprice } from '../lines'
import { stockItemsQueryOptions, toStockItemOptions } from '../queries'
import { SCAN_ACCEPT } from '../receipt-scan'
import { useInventoryActions } from '../use-inventory-actions'
import { useReceiptScan } from '../use-receipt-scan'
import { LineAmounts, PackHint } from './line-amounts'
import { ReceiptReviewSheet } from './receipt-review-sheet'

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

  // The supplier comes from Finance's list, so the delivery lands on their
  // account; a receipt without one is stock with no creditor
  const { data: suppliers = [] } = useQuery(suppliersQueryOptions())
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [invoiceRef, setInvoiceRef] = useState('')
  const [lines, setLines] = useState<Line[]>(() => [
    {
      ...newLine(),
      stockItemId:
        initialStockItemId != null ? String(initialStockItemId) : null,
    },
  ])

  // A photo of the receipt goes to the assistant; what it proposes comes
  // back through the review sheet as lines, never straight into the post
  const scan = useReceiptScan()
  const scanInputRef = useRef<HTMLInputElement>(null)

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
    if (!lines.every(isComplete)) {
      toast.error(t('purchaseLineIncomplete'))
      return
    }
    try {
      const picked = suppliers.find((s) => String(s.id) === supplierId)
      await receivePurchase({
        supplier: picked?.name ?? null,
        supplierId: picked ? toNumber(picked.id) : null,
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
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => setLines((prev) => [...prev, newLine()])}
          >
            <Plus className='me-1 h-4 w-4' />
            {t('addLine')}
          </Button>
          {scan.available && (
            <>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={scan.isScanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scan.isScanning ? (
                  <Spinner className='me-1' />
                ) : (
                  <ScanLine className='me-1 h-4 w-4' />
                )}
                {scan.isScanning ? t('readingReceipt') : t('scanReceipt')}
              </Button>
              {scan.isScanning && (
                <span className='text-muted-foreground text-xs'>
                  {t('readingReceiptHint')}
                </span>
              )}
              {/* No `capture`: the native chooser offers the camera and the
                  gallery, and receipts often arrive as a WhatsApp photo */}
              <input
                ref={scanInputRef}
                type='file'
                accept={SCAN_ACCEPT}
                className='hidden'
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) void scan.scanFile(file)
                }}
              />
            </>
          )}
        </div>
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

      {scan.proposal && (
        <ReceiptReviewSheet
          proposal={scan.proposal}
          items={items}
          suppliers={suppliers}
          onOpenChange={(open) => {
            if (!open) scan.clearProposal()
          }}
          onConfirm={(result) => {
            if (result.supplierId != null) setSupplierId(result.supplierId)
            if (result.invoiceRef && !invoiceRef.trim())
              setInvoiceRef(result.invoiceRef)
            // Scanned lines join what is there; an untouched empty first
            // line would only get in the way
            setLines((prev) => [
              ...prev.filter(
                (line) =>
                  line.stockItemId || line.quantity || line.total || line.packs
              ),
              ...result.lines,
            ])
            scan.clearProposal()
            toast.success(t('scannedLinesAdded'))
          }}
        />
      )}
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
        <LineAmounts
          line={line}
          unit={item?.unit}
          packSize={packSize}
          onChange={onChange}
        />
      </div>
      {item && (
        <PackHint
          line={line}
          unit={item.unit}
          packSize={packSize}
          packName={item.packName}
        />
      )}
    </div>
  )
}
