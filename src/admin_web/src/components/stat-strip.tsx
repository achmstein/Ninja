import { Children } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type Tone = 'default' | 'positive' | 'negative' | 'warning' | 'muted'

const toneClass: Record<Tone, string> = {
  default: '',
  positive: 'text-success',
  negative: 'text-destructive',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
}

type StatProps = {
  label: React.ReactNode
  value: React.ReactNode
  /** One short line under the value: a count, a comparison */
  hint?: React.ReactNode
  tone?: Tone
  /** The list that explains this number */
  to?: LinkProps['to']
  search?: LinkProps['search']
  loading?: boolean
  /** `hero` is the one big unboxed number of a page; `default` is a strip cell */
  size?: 'default' | 'hero'
  className?: string
}

/**
 * One number with its label. Inside a `StatStrip` it is a divided cell;
 * standalone with `size='hero'` it is the page's headline figure. Never a
 * Card of its own — a row of boxes is exactly the noise we are removing.
 */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  to,
  search,
  loading,
  size = 'default',
  className,
}: StatProps) {
  const hero = size === 'hero'
  const body = (
    <>
      <div className='text-muted-foreground text-xs font-medium'>{label}</div>
      {loading ? (
        <Skeleton className={cn('mt-1', hero ? 'h-10 w-40' : 'h-7 w-24')} />
      ) : (
        <div
          className={cn(
            'font-semibold tracking-tight whitespace-nowrap tabular-nums',
            hero ? 'text-4xl' : 'text-lg @5xl:text-xl',
            toneClass[tone]
          )}
        >
          {value}
        </div>
      )}
      {hint && (
        <div className='text-muted-foreground text-xs tabular-nums'>{hint}</div>
      )}
    </>
  )

  const cellClass = cn(
    'flex min-w-0 flex-col gap-0.5',
    hero ? '' : 'p-3 @5xl:p-4',
    className
  )

  if (to) {
    return (
      <Link
        to={to}
        search={search}
        className={cn(
          cellClass,
          'hover:bg-accent/50 focus-visible:ring-ring/50 transition-colors outline-none focus-visible:ring-[3px]'
        )}
      >
        {body}
      </Link>
    )
  }
  return <div className={cellClass}>{body}</div>
}

type StatStripProps = {
  children: React.ReactNode
  className?: string
}

/**
 * One bordered surface holding a row of `Stat` cells, divided by hairlines.
 * From a tablet's width up the cells stay on ONE row whatever their number
 * (the strip scrolls sideways before it ever stacks — a strip that wraps
 * into rows of boxes is the card grid this replaces); phones get two
 * columns. Cell borders are drawn on the end/bottom edges and the last
 * ones are hidden under the frame, so it mirrors correctly in RTL.
 */
export function StatStrip({ children, className }: StatStripProps) {
  const count = Children.count(children)
  return (
    <div
      className={cn(
        // Container query so the strip fits its parent (a page or a sheet),
        // not the viewport: 2 columns on a phone, one row from ~42rem
        'bg-card @container overflow-x-auto rounded-lg border',
        className
      )}
      style={{ '--cols': count } as React.CSSProperties}
    >
      <div className='-me-px -mb-px grid grid-cols-2 @2xl:grid-cols-(--cols) [&>*]:border-e [&>*]:border-b @2xl:[&>*]:min-w-28'>
        {children}
      </div>
    </div>
  )
}
