import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A word to the customer about the page they are on, one look wherever it
 * shows: an icon in a soft round, a short title and a line under it, and a
 * way on when there is one. `paused` is the café not taking orders or
 * bookings for now: a warm amber, not an error's red, since nothing went
 * wrong and it comes back on its own. `invite` asks something of them (a
 * sign-in to book) in the café's colour.
 */
export function Notice({
  tone,
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  tone: 'paused' | 'invite'
  icon: ComponentType<{ className?: string }>
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'paused' ? 'status' : undefined}
      className={cn(
        'flex flex-col gap-3 rounded-[1.5rem] p-4',
        tone === 'paused' ? 'bg-amber-500/12 text-amber-950 dark:text-amber-100' : 'bg-primary/10 text-foreground',
        className
      )}
    >
      <div className='flex items-center gap-3'>
        <span
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-full',
            tone === 'paused' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300' : 'bg-primary text-primary-foreground'
          )}
        >
          <Icon className='size-5' />
        </span>
        <span className='flex min-w-0 flex-col'>
          <span className='text-[15px] leading-snug font-semibold'>{title}</span>
          {body && <span className='text-[13px] leading-snug opacity-75'>{body}</span>}
        </span>
      </div>
      {action}
    </div>
  )
}

/** The notice's way on: a full-width pill in the café's colour */
export const noticeAction =
  'bg-primary text-primary-foreground flex h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-bold transition-transform active:scale-[0.98] motion-reduce:transform-none'
