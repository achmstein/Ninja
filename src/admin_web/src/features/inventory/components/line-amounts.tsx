import { useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { costChange, unitLabel } from '../format'
import { type Amounts } from '../lines'

type LineAmountsProps = {
  line: Amounts
  /** The item's base unit; undefined until an item is picked */
  unit: string | undefined
  /** Base units per pack, 0 for items sold loose */
  packSize: number
  onChange: (patch: Partial<Amounts>) => void
  /** Show the small labels at every width (no header row above) */
  labelsAlways?: boolean
}

/**
 * The three numbers of a delivery line: packs (or quantity for loose
 * items), unit cost and total. Rendered as siblings so the parent's grid
 * lays them out; `reprice` keeps them consistent.
 */
export function LineAmounts({
  line,
  unit,
  packSize,
  onChange,
  labelsAlways,
}: LineAmountsProps) {
  const t = useT()
  const hasPack = packSize > 0

  return (
    <>
      {hasPack ? (
        <LabeledInput label={t('packs')} always={labelsAlways}>
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
            unit ? `${t('quantity')} (${unitLabel(unit, t)})` : t('quantity')
          }
          always={labelsAlways}
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
        label={`${t('unitCost')}${unit ? ` / ${unitLabel(unit, t)}` : ''}`}
        always={labelsAlways}
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
      <LabeledInput label={t('total')} always={labelsAlways}>
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
    </>
  )
}

/** "× bag of 1000 g = 2000 g" under a line bought by the pack */
export function PackHint({
  line,
  unit,
  packSize,
  packName,
}: {
  line: Amounts
  unit: string
  packSize: number
  packName: string | null | undefined
}) {
  const t = useT()
  if (!(packSize > 0)) return null
  return (
    <p className='text-muted-foreground text-xs'>
      ×{' '}
      {t('packOf', {
        packName: packName || t('pack'),
        packSize,
        unit: unitLabel(unit, t),
      })}
      {line.quantity && ` = ${toNumber(line.quantity)} ${unitLabel(unit, t)}`}
    </p>
  )
}

/**
 * "Last 0.048 / g" under a line's unit cost, with the change against it once
 * a cost is typed; red or green when it moved a tenth or more, so a price
 * creep is seen before it moves the average.
 */
export function CostHint({
  line,
  unit,
  lastCost,
}: {
  line: Amounts
  unit: string
  lastCost: number | null | undefined
}) {
  const t = useT()
  if (!lastCost || lastCost <= 0) return null
  const change = costChange(parseFloat(line.unitCost), lastCost)
  return (
    <p className='text-muted-foreground text-xs tabular-nums'>
      {t('lastCostLine', {
        cost: formatEgp(lastCost),
        unit: unitLabel(unit, t),
      })}
      {change !== null && (
        <span
          className={cn(
            'ms-1 font-medium',
            change.flagged &&
              (change.percent > 0 ? 'text-destructive' : 'text-success')
          )}
        >
          ({change.percent > 0 ? '+' : ''}
          {change.percent}%)
        </span>
      )}
    </p>
  )
}

/**
 * A field with its label above it on a phone, where the columns stack and a
 * bare number box would mean nothing. On a wide screen the header row names
 * the columns and the label is hidden, unless `always` asks for it.
 */
function LabeledInput({
  label,
  always,
  children,
}: {
  label: string
  always?: boolean
  children: React.ReactNode
}) {
  return (
    <div className='space-y-1'>
      <span
        className={cn(
          'text-muted-foreground block truncate text-xs',
          !always && 'sm:hidden'
        )}
      >
        {label}
      </span>
      {children}
    </div>
  )
}
