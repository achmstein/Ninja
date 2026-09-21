import { cn } from '@/lib/utils'

type WordmarkProps = {
  /** `sm` for the app chrome, `lg` for a splash */
  size?: 'sm' | 'lg'
  className?: string
}

/**
 * The platform's own name: "ninja" in the display face carries the brand;
 * a hairline and "control" in small letterspaced caps say which of its
 * apps this is, as a label rather than a second word. A Latin wordmark, so
 * it keeps its own direction on an Arabic page. Tenant apps never render
 * this; their chrome carries the café's mark instead.
 */
export function Wordmark({ size = 'sm', className }: WordmarkProps) {
  return (
    <span
      dir='ltr'
      className={cn(
        'inline-flex items-center',
        size === 'lg' ? 'gap-4' : 'gap-3',
        className
      )}
    >
      <span
        className={cn(
          'font-display leading-none',
          size === 'lg' ? 'text-5xl' : 'text-[22px]'
        )}
      >
        ninja
      </span>
      <span
        aria-hidden
        className={cn('bg-border w-px', size === 'lg' ? 'h-7' : 'h-4')}
      />
      <span
        className={cn(
          'text-muted-foreground font-medium uppercase',
          size === 'lg' ? 'text-sm tracking-[0.2em]' : 'text-[11px] tracking-[0.14em]'
        )}
      >
        control
      </span>
    </span>
  )
}
