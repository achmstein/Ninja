import type { ReactNode } from 'react'
import { Check, Minus, Plus, Trash2 } from 'lucide-react'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import { mergeIdenticalLines, PAID_DIM, PaidTag } from '@/features/ticket/bill-lines'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { lineKey, type SaleLine } from './cart'

/** A quiet heading over a part of the order: what is new, what was sent */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className='text-muted-foreground px-3 pt-3 pb-1 type-label'>{children}</div>
}

/**
 * A line being rung up: its name and options, and its count to change. Marked
 * down its start edge, so what is new is told from what was sent at a glance.
 */
export function NewLineRow({
  line,
  onSetQuantity,
  marked,
}: {
  line: SaleLine
  onSetQuantity: (key: string, quantity: number) => void
  /** On an open bill, where sent lines sit under it */
  marked: boolean
}) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const money = useMoney()
  const key = lineKey(line)
  // A business may write its menu in one language only: each name falls back to the other
  const name = (language === 'ar' ? line.nameAr : line.nameEn) || line.nameEn || line.nameAr
  const options = line.customizations
    .map((c) => (language === 'ar' ? c.optionNameAr : c.optionNameEn) || c.optionNameEn || c.optionNameAr || '')
    .join(' · ')

  return (
    <div className={cn('flex items-start gap-2 px-3 py-2', marked && 'border-primary bg-primary/5 border-s-[3px] ps-[calc(0.75rem-3px)]')}>
      <div className='min-w-0 flex-1'>
        <div className='type-detail truncate font-medium'>{name}</div>
        {options && <div className='text-muted-foreground type-caption truncate'>{options}</div>}
        {line.who && (
          <div className='text-foreground/70 type-caption truncate font-medium'>
            <bdi>{line.who.name || t('guest')}</bdi>
          </div>
        )}
        {line.specialInstructions && (
          <div className='text-muted-foreground type-caption truncate italic'>"{line.specialInstructions}"</div>
        )}
        <div className='mt-1.5 flex items-center gap-2'>
          <Button
            variant='outline'
            size='icon'
            className='bg-background size-9 rounded-full'
            aria-label={line.quantity === 1 ? t('remove') : t('decrease')}
            onClick={() => onSetQuantity(key, line.quantity - 1)}
          >
            {line.quantity === 1 ? <Trash2 className='text-destructive size-4' /> : <Minus className='size-4' />}
          </Button>
          <span className='type-detail w-6 text-center font-semibold tabular-nums'>{line.quantity}</span>
          <Button
            variant='outline'
            size='icon'
            className='bg-background size-9 rounded-full'
            aria-label={t('increase')}
            onClick={() => onSetQuantity(key, line.quantity + 1)}
          >
            <Plus className='size-4' />
          </Button>
        </div>
      </div>
      <span className='type-detail shrink-0 font-semibold tabular-nums'>{money(line.price * line.quantity)}</span>
    </div>
  )
}

/** Who a sent line was for, as the bill keeps them apart: an account, else the name told, else nobody */
const whoKey = (line: TicketLineView) =>
  (line.customerId ? `id:${line.customerId}` : line.customerName ? `name:${line.customerName}` : '') + (line.paid ? '|paid' : '')

/** The lines being picked, to move to another bill or to name: which, and the tap that picks one */
export type LineSelection = { chosen: ReadonlySet<number>; onToggle: (lineId: number) => void }

/**
 * What an open bill already holds, as one quiet list. The same item ordered
 * twice for the same person reads as one line; a line that was for somebody
 * says so under it, by their whole name, which is all that tells whose is
 * whose. While lines are being picked each round stands on its own with a
 * box to tick; the room's time is the room's and is never picked.
 */
export function SentLines({
  lines,
  landed,
  selection,
}: {
  lines: TicketLineView[]
  landed: readonly number[]
  selection?: LineSelection
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  // Merged person by person, so one person's two coffees add up without taking another's with them
  const keys = [...new Set(lines.map(whoKey))]
  const shown = selection ? lines : keys.flatMap((key) => mergeIdenticalLines(lines.filter((line) => whoKey(line) === key)))

  // One column for the whole list, as wide as its widest count: a room's hours
  // (1.25×) are wider than a whole count, and the names still start in one line
  const countWidth = `max(1.75rem, ${Math.max(...shown.map((line) => `${toNumber(line.qty)}×`.length), 0)}ch)`

  return (
    <div className='flex flex-col divide-y'>
      {shown.map((line) => {
        const id = toNumber(line.id)
        const negative = toNumber(line.total) < 0
        const pickable = !!selection && line.source !== 'SessionTime' && !line.paid
        const picked = pickable && selection.chosen.has(id)
        const body = (
          <>
            {selection && (
              <span
                aria-hidden
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-md border',
                  !pickable && 'invisible',
                  picked ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50',
                )}
              >
                {picked && <Check className='size-4' />}
              </span>
            )}
            <span style={{ width: countWidth }} className={cn('shrink-0 font-medium whitespace-nowrap tabular-nums', line.paid && PAID_DIM)}>{toNumber(line.qty)}×</span>
            <span className={cn('min-w-0 flex-1', line.paid && PAID_DIM)}>
              <span className={cn('block truncate', negative && 'text-emerald-600 dark:text-emerald-400')}>
                {localized(line.description)}
              </span>
              {localized(line.details) && <span className='type-caption block truncate'>{localized(line.details)}</span>}
              {line.customerName && (
                <span className='text-foreground/70 type-caption block truncate font-medium'>
                  <bdi>{line.customerName}</bdi>
                </span>
              )}
            </span>
            {line.paid && <PaidTag />}
            <span className={cn('w-20 shrink-0 text-end tabular-nums', negative && 'text-emerald-600 dark:text-emerald-400', line.paid && PAID_DIM)}>
              {money(line.total)}
            </span>
          </>
        )
        const row = cn(
          'text-muted-foreground flex min-h-11 w-full items-center gap-2 px-3 py-2 type-detail text-start',
          // Just in from the server: a soft tint behind it fades out
          landed.includes(toNumber(line.orderId)) && 'animate-landed',
          picked && 'bg-accent',
        )
        return pickable ? (
          <button
            key={String(line.id)}
            type='button'
            role='checkbox'
            aria-checked={picked}
            aria-label={t('selectLines')}
            onClick={() => selection.onToggle(id)}
            className={cn(row, 'hover:bg-accent/60')}
          >
            {body}
          </button>
        ) : (
          <div key={String(line.id)} className={row}>
            {body}
          </div>
        )
      })}
    </div>
  )
}