import { cn } from '@/lib/utils'

export type Urgency = 'fresh' | 'warning' | 'delayed'

type QueueCardProps = React.HTMLAttributes<HTMLDivElement> & {
  urgency?: Urgency
  /** Newly arrived cards rise in; refetches reuse keys so only new ones animate */
  animate?: boolean
}

/**
 * The card shape for anything waiting on staff (an order, a service
 * request): a bordered ticket whose edge glows amber, then red, as it ages.
 * This is one of the few places a bordered box is the right container: each
 * card is a self-contained thing to act on.
 */
export function QueueCard({
  urgency = 'fresh',
  animate = true,
  className,
  children,
  ...props
}: QueueCardProps) {
  return (
    <div
      className={cn(
        'bg-card flex flex-col rounded-lg border p-4 transition-[border-color,box-shadow] duration-500 ease-out',
        animate && 'animate-in fade-in-0 zoom-in-95 slide-in-from-top-4',
        urgency === 'delayed' &&
          'border-destructive/70 shadow-[0_0_12px_3px_color-mix(in_oklch,var(--destructive)_35%,transparent)]',
        urgency === 'warning' &&
          'border-warning/70 shadow-[0_0_10px_2px_color-mix(in_oklch,var(--warning)_25%,transparent)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** Text colour for an age label, matching the card edge. */
export function urgencyTextClass(urgency: Urgency): string {
  return urgency === 'delayed'
    ? 'text-destructive font-medium'
    : urgency === 'warning'
      ? 'text-warning font-medium'
      : 'text-muted-foreground'
}

/** Age → urgency, with the thresholds each queue picks (minutes). */
export function urgencyFor(
  since: string | undefined,
  nowMs: number,
  warnAfter: number,
  delayedAfter: number
): Urgency {
  if (!since) return 'fresh'
  const minutes = (nowMs - new Date(since).getTime()) / 60_000
  if (minutes >= delayedAfter) return 'delayed'
  if (minutes >= warnAfter) return 'warning'
  return 'fresh'
}
