import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

export type Segment = {
  key: string
  label: string
  value: number
  /** Formatted value for the legend (money, count) */
  display?: string
  /** Secondary text in the legend (a count next to an amount) */
  hint?: string
  /** Any CSS colour; defaults to the chart palette by position */
  color?: string
  to?: LinkProps['to']
  search?: LinkProps['search']
}

const palette = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

type SegmentedBarProps = {
  segments: Segment[]
  /** Hide the legend rows when the caller renders its own */
  legend?: boolean
  className?: string
}

/**
 * A distribution in one glance: a stacked bar with a legend row per part.
 * Tender split, tier distribution, sales by ticket type — anywhere a set of
 * numbers sums to a whole, this replaces a grid of tiles.
 */
export function SegmentedBar({
  segments,
  legend = true,
  className,
}: SegmentedBarProps) {
  const total = segments.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const colored = segments.map((s, i) => ({
    ...s,
    color: s.color ?? palette[i % palette.length],
  }))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className='bg-muted flex h-2.5 w-full overflow-hidden rounded-full'
        role='img'
        aria-label={colored
          .map((s) => `${s.label}: ${s.display ?? s.value}`)
          .join(', ')}
      >
        {total > 0 &&
          colored
            .filter((s) => s.value > 0)
            .map((s) => (
              <div
                key={s.key}
                className='h-full transition-[width] duration-500'
                style={{
                  width: `${(s.value / total) * 100}%`,
                  backgroundColor: s.color,
                }}
              />
            ))}
      </div>
      {legend && (
        <ul className='divide-y text-sm'>
          {colored.map((s) => {
            const row = (
              <>
                <span
                  className='size-2.5 shrink-0 rounded-full'
                  style={{ backgroundColor: s.color }}
                />
                <span className='flex-1 truncate'>{s.label}</span>
                {s.hint && (
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {s.hint}
                  </span>
                )}
                <span className='font-medium tabular-nums'>
                  {s.display ?? s.value}
                </span>
              </>
            )
            const rowClass = 'flex items-center gap-2 py-2'
            return (
              <li key={s.key}>
                {s.to ? (
                  <Link
                    to={s.to}
                    search={s.search}
                    className={cn(
                      rowClass,
                      'hover:text-foreground hover:bg-accent/50 -mx-2 rounded-md px-2 transition-colors'
                    )}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
