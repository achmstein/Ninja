import { cn } from '@/lib/utils'

/**
 * Loading placeholder.
 *
 * A sweep rather than a pulse: the highlight travels in the reading direction,
 * so it also runs right-to-left in Arabic. `motion-reduce` falls back to the
 * plain block for anyone who has asked the OS for less animation.
 *
 * Pair it with a co-located skeleton that mirrors the real component's layout
 * (see ItemRowSkeleton) rather than dropping a bare box in place of a card -
 * a placeholder only earns its keep when it reserves the same space.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot='skeleton'
      className={cn(
        'bg-accent relative isolate overflow-hidden rounded-md',
        'motion-reduce:animate-pulse',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[skeleton-sweep_1.6s_infinite]',
        'after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent',
        'rtl:after:translate-x-full rtl:after:bg-gradient-to-l',
        'motion-reduce:after:hidden',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
