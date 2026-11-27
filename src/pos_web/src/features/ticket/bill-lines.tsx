import { Check } from 'lucide-react'
import type { TicketLineView } from '@/api/sales/types.gen'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * A bill reads by item, not by round. Ordering the same thing twice in an
 * evening writes two lines — two orders, two kitchen tickets, two audit rows,
 * all of which stay exactly as they are underneath — but on screen they add
 * up to "Cappuccino 2 ×". Only identical lines merge: same item, same options,
 * same price, same discount, same origin; and what a part payment already
 * paid for stays apart from what is still to pay.
 */
export function mergeIdenticalLines(lines: TicketLineView[]): TicketLineView[] {
  const merged: TicketLineView[] = []
  const seen = new Map<string, number>()

  for (const line of lines) {
    // JSON rather than a delimiter: no separator can collide with an item
    // name, however it is punctuated
    const key = JSON.stringify([
      line.source,
      line.description?.en ?? '',
      line.description?.ar ?? '',
      line.details?.en ?? '',
      line.details?.ar ?? '',
      line.unitPrice,
      line.discount,
      line.paid ?? false,
    ])

    const at = seen.get(key)

    if (at === undefined) {
      seen.set(key, merged.length)
      merged.push({ ...line })
      continue
    }

    merged[at] = {
      ...merged[at],
      qty: toNumber(merged[at].qty) + toNumber(line.qty),
      total: toNumber(merged[at].total) + toNumber(line.total),
    }
  }

  return merged
}

/** A paid line steps back whole (its name, its count, its amount), so what is left to pay is what the eye lands on; its tag stays at full strength */
export const PAID_DIM = 'opacity-50'

/** Paid for by a part payment while the bill is open: said beside the line, wherever a bill's lines are listed */
export function PaidTag() {
  const t = useT()
  return (
    <span className='type-caption shrink-0 rounded-full bg-emerald-500/10 px-2 font-semibold text-emerald-700 dark:text-emerald-400'>
      {t('paidTag')}
    </span>
  )
}

export function LineRow({
  line,
  selecting,
  selected,
  onToggle,
  landed = false,
}: {
  line: TicketLineView
  selecting: boolean
  selected: boolean
  onToggle: () => void
  /** Just confirmed by the server: a soft tint behind it fades out */
  landed?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  const isNegative = toNumber(line.total) < 0
  const discount = toNumber(line.discount)
  // Session time belongs to the session, and what a part payment paid for is done: neither is offered for a move
  const selectable = selecting && line.source !== 'SessionTime' && !line.paid

  const content = (
    <>
      {selectable && (
        <span
          aria-hidden
          className={cn(
            'border-input mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border',
            selected && 'bg-primary text-primary-foreground border-primary',
          )}
        >
          {selected && <Check className='size-4' />}
        </span>
      )}
      <div className={cn('min-w-0 flex-1', line.paid && PAID_DIM)}>
        <div
          className={cn(
            'truncate type-body font-medium',
            isNegative && 'text-emerald-600 dark:text-emerald-400',
          )}
        >
          {localized(line.description)}
        </div>
        {localized(line.details) && (
          <div className='text-muted-foreground truncate type-detail'>
            {localized(line.details)}
          </div>
        )}
        <div className='text-muted-foreground type-detail tabular-nums'>
          {toNumber(line.qty)} × {money(line.unitPrice)}
          {discount > 0 && (
            <span>
              {' '}
              − {money(discount)} ({t('discount')})
            </span>
          )}
        </div>
      </div>
      {line.paid && <PaidTag />}
      <div
        className={cn(
          'shrink-0 type-body font-semibold tabular-nums',
          isNegative && 'text-emerald-600 dark:text-emerald-400',
          line.paid && PAID_DIM,
        )}
      >
        {money(line.total)}
      </div>
    </>
  )

  if (selectable) {
    return (
      <button
        type='button'
        onClick={onToggle}
        className={cn(
          'flex min-h-12 w-full items-start gap-3 rounded-lg px-3 py-2 text-start',
          selected ? 'bg-accent' : 'hover:bg-accent/50',
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-12 items-start gap-3 rounded-lg px-3 py-2',
        // Just in: it stops breathing (features/sending) and a soft tint
        // behind it fades out, so the eye finds what was added
        landed && 'animate-landed',
      )}
    >
      {content}
    </div>
  )
}
