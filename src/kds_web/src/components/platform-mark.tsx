import { cn } from '@/lib/utils'
import { PLATFORM_NAME } from '@/lib/brand'

/**
 * The platform's mark on a staff surface: a neutral tile with its initial.
 * The tenant's own logo stays on what customers see and on printed paper
 * (see BrandMark).
 */
export function PlatformMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      title={PLATFORM_NAME}
      className={cn(
        'bg-foreground text-background grid shrink-0 place-items-center rounded-md font-semibold leading-none',
        className
      )}
    >
      {PLATFORM_NAME.charAt(0)}
    </span>
  )
}
