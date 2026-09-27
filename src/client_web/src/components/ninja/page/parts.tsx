import { useRef, type ComponentType, type ReactNode } from 'react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'
import { cn } from '@/lib/utils'
import { LiquidPill } from '../liquid-pill'
import { useLiquidEdges } from '../use-liquid'

/**
 * The dark slab the dock is made of, for the one thing a page is about:
 * the bill running now, the clock on a place, who you are. The muted text,
 * the fills and the lines inside it are re-tinted for the dark, so any part
 * set in them reads on it.
 */
export function Slab({ className, children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      className={cn(
        'slab relative overflow-hidden rounded-[1.75rem] p-5 shadow-(--slab-shadow)',
        '[--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))] [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))]',
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** A filled card at the slab's corners, for everything else: flat like the tiles, the slab the one thing lifted */
export function Panel({ className, children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div className={cn('bg-muted rounded-[1.5rem]', className)} {...props}>
      {children}
    </motion.div>
  )
}

/** A small label over a group of panels or tiles */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-muted-foreground px-1 text-[13px] font-semibold', className)}>{children}</h2>
}

/**
 * Two or three choices in one track, the chosen one lifted by the same
 * liquid pill as the dock's tabs and the menu's categories.
 */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  className,
}: {
  options: ReadonlyArray<{ value: T; label: ReactNode; ariaLabel?: string }>
  value: T
  onChange: (value: T) => void
  /** The small one that sits at the end of a tile */
  compact?: boolean
  className?: string
}) {
  const row = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const active = Math.max(0, options.findIndex((o) => o.value === value))
  const edges = useLiquidEdges(active, items, row, options.map((o) => o.value).join())
  return (
    <div ref={row} role='tablist' className={cn('bg-muted relative flex items-stretch rounded-full p-1', compact ? 'h-9' : 'h-11', className)}>
      <LiquidPill edges={edges} height={compact ? 28 : 36} top={4} className='bg-background shadow-[0_1px_3px_rgb(0_0_0/0.12)]' />
      {options.map((option, i) => (
        <button
          key={option.value}
          ref={(el) => {
            items.current[i] = el
          }}
          type='button'
          role='tab'
          aria-selected={i === active}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
          className={cn(
            'relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-200',
            compact ? 'px-2.5 text-[13px]' : 'px-3 text-sm',
            i === active ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Nothing here yet: a glyph that floats a little in its tile, what is
 * missing in a line, and the way on.
 */
export function Empty({
  icon: Icon,
  title,
  note,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  title: ReactNode
  note?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  return (
    <div className={cn('flex flex-col items-center gap-4 px-6 py-12 text-center', className)}>
      <motion.div
        className='bg-muted text-muted-foreground grid size-20 place-items-center rounded-[1.75rem]'
        animate={reduced ? undefined : { y: [0, -5, 0] }}
        transition={{ duration: 3.2, ease: 'easeInOut', repeat: Infinity }}
      >
        <Icon className='size-9' />
      </motion.div>
      <div className='flex flex-col gap-1'>
        <p className='heading text-lg'>{title}</p>
        {note && <p className='text-muted-foreground text-[15px]'>{note}</p>}
      </div>
      {children}
    </div>
  )
}
