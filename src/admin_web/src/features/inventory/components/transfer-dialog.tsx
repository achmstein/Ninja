import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { type StockLevelView } from '@/api/inventory'
import { useBranchStore } from '@/stores/branch-store'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Combobox } from '@/components/combobox'
import { formatQuantity, unitLabel } from '../format'
import { stockLevelsQueryOptions, toStockItemOptions } from '../queries'
import { useInventoryActions } from '../use-inventory-actions'

interface TransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransferDialog({ open, onOpenChange }: TransferDialogProps) {
  const t = useT()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{t('transferStock')}</DialogTitle>
        </DialogHeader>
        {open && <TransferForm onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  )
}

type Line = {
  key: number
  stockItemId: string | null
  quantity: string
}

let lineKey = 0
const newLine = (): Line => ({
  key: lineKey++,
  stockItemId: null,
  quantity: '',
})

/** Column template shared by the header row and every line */
const LINE_GRID =
  'sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] sm:gap-2 sm:items-center'

function TransferForm({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const localized = useLocalized()
  const { transferStock, isPending } = useInventoryActions()
  const activeBranchId = useBranchStore((s) => s.branchId)
  const { branches } = useAllowedBranches()
  // Everywhere this account may send to, except where the stock already is
  const destinations = branches.filter(
    (branch) => toNumber(branch.id) !== activeBranchId
  )
  // Levels rather than the item list: the picker shows what is on hand here
  const { data: levels = [] } = useQuery(stockLevelsQueryOptions())
  const levelById = new Map(levels.map((l) => [String(l.stockItemId), l]))

  const [toBranchId, setToBranchId] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine()])

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!toBranchId) {
      toast.error(t('pickBranch'))
      return
    }
    if (lines.length === 0) {
      toast.error(t('transferNeedsLine'))
      return
    }
    const complete = lines.every(
      (line) => line.stockItemId && parseFloat(line.quantity) > 0
    )
    if (!complete) {
      toast.error(t('transferLineIncomplete'))
      return
    }
    try {
      await transferStock(Number(toBranchId), {
        note: note.trim() || null,
        lines: lines.map((line) => ({
          stockItemId: Number(line.stockItemId),
          quantity: parseFloat(line.quantity),
        })),
      })
      onOpenChange(false)
    } catch {
      // toasted by useInventoryActions
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='space-y-2'>
          <Label htmlFor='toBranch'>{t('toBranch')}</Label>
          <Select
            value={toBranchId}
            onValueChange={setToBranchId}
            disabled={destinations.length === 0}
          >
            <SelectTrigger id='toBranch' className='w-full'>
              <SelectValue
                placeholder={
                  destinations.length === 0
                    ? t('noOtherBranches')
                    : t('pickBranch')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {destinations.map((branch) => (
                <SelectItem key={String(branch.id)} value={String(branch.id)}>
                  {localized(branch.name)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-2'>
          <Label htmlFor='transferNote'>{t('notesOptional')}</Label>
          <Input
            id='transferNote'
            placeholder={t('transferNotePlaceholder')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
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
            <span className='text-end'>{t('onHand')}</span>
            <span className='w-9' />
          </div>
          <div className='divide-y'>
            {lines.map((line) => (
              <TransferLine
                key={line.key}
                line={line}
                level={
                  line.stockItemId ? levelById.get(line.stockItemId) : undefined
                }
                levels={levels}
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

      <DialogFooter>
        <Button
          type='button'
          variant='outline'
          onClick={() => onOpenChange(false)}
        >
          {t('cancel')}
        </Button>
        <Button type='submit' disabled={isPending || destinations.length === 0}>
          {isPending && <Spinner className='me-2' />}
          {t('transferStock')}
        </Button>
      </DialogFooter>
    </form>
  )
}

function TransferLine({
  line,
  level,
  levels,
  onChange,
  onRemove,
}: {
  line: Line
  level: StockLevelView | undefined
  levels: StockLevelView[]
  onChange: (patch: Partial<Line>) => void
  onRemove: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  // Sending more than is here is refused by the API; flag it before that
  const overdrawn =
    level !== undefined && parseFloat(line.quantity) > toNumber(level.onHand)

  return (
    <div className='px-3 py-2'>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${LINE_GRID}`}>
        <Combobox
          value={line.stockItemId}
          onChange={(value) => onChange({ stockItemId: value })}
          options={toStockItemOptions(levels, localized, t)}
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
        <LabeledInput
          label={
            level
              ? `${t('quantity')} (${unitLabel(level.unit, t)})`
              : t('quantity')
          }
        >
          <Input
            type='number'
            min='0'
            step='any'
            placeholder='0'
            aria-label={t('quantity')}
            aria-invalid={overdrawn || undefined}
            value={line.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </LabeledInput>
        <LabeledInput label={t('onHand')}>
          <div
            className={cn(
              'flex h-9 items-center justify-end text-sm tabular-nums',
              overdrawn
                ? 'text-destructive font-medium'
                : 'text-muted-foreground'
            )}
          >
            {level ? formatQuantity(level.onHand, level.unit, t) : '—'}
          </div>
        </LabeledInput>
      </div>
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
