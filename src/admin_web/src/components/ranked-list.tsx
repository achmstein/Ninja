import { cn } from '@/lib/utils'

export type RankedItem = {
  key: string
  label: string
  value: number
  /** Formatted value (units, hours, money) */
  display: string
  /** Secondary text after the value */
  hint?: string
}

type RankedListProps = {
  items: RankedItem[]
  className?: string
}

/**
 * A top-N as a list you can read without hovering: label, value, and a bar
 * proportional to the largest entry. Replaces horizontal bar charts whose
 * axis had to be hidden to fit.
 */
export function RankedList({ items, className }: RankedListProps) {
  const max = Math.max(0, ...items.map((item) => item.value))
  return (
    <ol className={cn('divide-y', className)}>
      {items.map((item, index) => (
        <li key={item.key} className='flex items-center gap-3 py-2 text-sm'>
          <span className='text-muted-foreground w-5 shrink-0 text-end text-xs tabular-nums'>
            {index + 1}
          </span>
          <div className='min-w-0 flex-1'>
            <div className='flex items-baseline justify-between gap-3'>
              <span className='truncate font-medium'>{item.label}</span>
              <span className='shrink-0 tabular-nums'>
                {item.display}
                {item.hint && (
                  <span className='text-muted-foreground ms-1.5 text-xs'>
                    {item.hint}
                  </span>
                )}
              </span>
            </div>
            <div className='bg-muted mt-1 h-1 w-full overflow-hidden rounded-full'>
              <div
                className='bg-primary/70 h-full rounded-full'
                style={{ width: `${max > 0 ? (item.value / max) * 100 : 0}%` }}
              />
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}
