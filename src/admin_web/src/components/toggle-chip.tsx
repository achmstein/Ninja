import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A choice that is on or off, among others (branches, weekdays): on, it is
 * filled in the primary colour with a tick; off, it is a dashed outline in
 * muted ink, so which ones are chosen reads at a glance. `compact` drops the
 * tick for a narrow chip (a weekday's) where the fill alone says it.
 */
export function ToggleChip({
  on,
  onToggle,
  compact = false,
  className,
  children,
}: {
  on: boolean
  onToggle: () => void
  compact?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type='button'
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        'focus-visible:ring-ring/50 inline-flex h-8 items-center justify-center gap-1.5 rounded-md border text-xs font-medium transition-colors outline-none focus-visible:ring-[3px]',
        compact ? 'px-0' : 'px-3',
        on
          ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground border-dashed bg-transparent',
        className
      )}
    >
      {on && !compact && <Check className='size-3.5' strokeWidth={3} />}
      {children}
    </button>
  )
}
