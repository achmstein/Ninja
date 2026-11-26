import type { ReactNode } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import type { TicketLineView } from '@/api/sales/types.gen'
import { Button } from '@/components/ui/button'
import { mergeIdenticalLines } from '@/features/ticket/bill-lines'
import { useLanguage, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { firstName } from './bill-people'
import { lineKey, type SaleLine } from './cart'

/** A quiet heading over a part of the order: what is new, what was sent */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className='text-muted-foreground px-3 pt-3 pb-1 text-xs font-semibold tracking-wide uppercase'>{children}</div>
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
        <div className='truncate text-sm font-medium'>{name}</div>
        {options && <div className='text-muted-foreground truncate text-xs'>{options}</div>}
        {line.specialInstructions && (
          <div className='text-muted-foreground truncate text-xs italic'>"{line.specialInstructions}"</div>
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
          <span className='w-6 text-center text-sm font-semibold tabular-nums'>{line.quantity}</span>
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
      <span className='shrink-0 text-sm font-semibold tabular-nums'>{money(line.price * line.quantity)}</span>
    </div>
  )
}

/** Who a sent line was for, as the bill keeps them apart: an account, else the name told, else nobody */
const whoKey = (line: TicketLineView) =>
  line.customerId ? `id:${line.customerId}` : line.customerName ? `name:${line.customerName}` : ''

/**
 * What an open bill already holds, as one quiet list. The same item ordered
 * twice for the same person reads as one line; a line that was for somebody
 * ends with their first name, which is all that says whose is whose.
 */
export function SentLines({ lines, landed }: { lines: TicketLineView[]; landed: readonly number[] }) {
  const localized = useLocalized()
  const money = useMoney()

  // Merged person by person, so one person's two coffees add up without taking another's with them
  const keys = [...new Set(lines.map(whoKey))]
  const merged = keys.flatMap((key) => mergeIdenticalLines(lines.filter((line) => whoKey(line) === key)))

  return (
    <div className='flex flex-col divide-y'>
      {merged.map((line) => {
        const negative = toNumber(line.total) < 0
        return (
          <div
            key={String(line.id)}
            className={cn(
              'text-muted-foreground flex min-h-11 items-center gap-2 px-3 py-2 text-sm',
              // Just in from the server: a soft tint behind it fades out
              landed.includes(toNumber(line.orderId)) && 'animate-landed',
            )}
          >
            <span className='w-7 shrink-0 font-medium tabular-nums'>{toNumber(line.qty)}×</span>
            <span className='min-w-0 flex-1'>
              <span className={cn('block truncate', negative && 'text-emerald-600 dark:text-emerald-400')}>
                {localized(line.description)}
              </span>
              {localized(line.details) && <span className='block truncate text-xs'>{localized(line.details)}</span>}
            </span>
            {line.customerName && (
              <bdi className='bg-muted max-w-[30%] shrink-0 truncate rounded-full px-2 py-0.5 text-xs'>
                {firstName(line.customerName)}
              </bdi>
            )}
            <span className={cn('w-20 shrink-0 text-end tabular-nums', negative && 'text-emerald-600 dark:text-emerald-400')}>
              {money(line.total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
