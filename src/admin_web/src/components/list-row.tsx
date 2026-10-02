import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * One row of a list as a phone shows it, and as the table's narrow mode
 * draws each row: what it is (bold, one line) with a quiet line under it,
 * and the figure that matters at the end with its own small line (a state,
 * a time). Something may lead it: an avatar, an icon, a checkbox.
 */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  trailingMeta,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  trailingMeta?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      {leading}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium'>{title}</div>
        {meta && (
          <div className='text-muted-foreground mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs'>
            {meta}
          </div>
        )}
      </div>
      {(trailing || trailingMeta) && (
        <div className='flex shrink-0 flex-col items-end gap-1 text-end'>
          {trailing && (
            <div className='text-sm font-medium tabular-nums'>{trailing}</div>
          )}
          {trailingMeta}
        </div>
      )}
    </div>
  )
}

/** A middle dot between the parts of a row's quiet line */
export function Dot() {
  return <span aria-hidden>·</span>
}
