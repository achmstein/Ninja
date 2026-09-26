import { type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Loader2 } from 'lucide-react'
import { blurSwap, duration, spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

export type MorphPhase = 'idle' | 'busy' | 'success' | 'error'

type MorphButtonProps = {
  phase: MorphPhase
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
  /** Handed to the success circle, so whatever mounts next with the same id grows out of it */
  layoutId?: string
  /** Button height in px; busy and success are sized from it */
  height?: number
}

/**
 * One button that becomes each step of its action instead of being swapped
 * out: full width → a spinner pill → a green circle with a tick. Width rides
 * the shared spring, colour eases, the content swaps through a short blur.
 * An error shakes it twice in 200 ms and it is a button again. Under
 * reduced motion the shape changes at once and only the content fades.
 */
export function MorphButton({
  phase,
  children,
  onClick,
  disabled,
  className,
  layoutId,
  height = 44,
}: MorphButtonProps) {
  const reduced = useReducedMotion()
  const width =
    phase === 'busy' ? height * 2 : phase === 'success' ? height : '100%'
  const round = phase === 'busy' || phase === 'success'
  const swap = blurSwap(reduced)

  return (
    <motion.button
      type='button'
      layoutId={phase === 'success' ? layoutId : undefined}
      initial={false}
      animate={{
        width,
        x: phase === 'error' && !reduced ? [0, -6, 6, -3, 3, 0] : 0,
      }}
      transition={{
        width: reduced ? { duration: 0 } : spring,
        x: { duration: 0.2, ease: 'easeOut' },
      }}
      whileTap={phase === 'idle' && !disabled && !reduced ? { scale: 0.97 } : undefined}
      onClick={phase === 'idle' || phase === 'error' ? onClick : undefined}
      disabled={disabled}
      aria-busy={phase === 'busy'}
      style={{ height, borderRadius: round ? height / 2 : undefined }}
      className={cn(
        'relative mx-auto inline-flex shrink-0 items-center justify-center overflow-hidden text-sm font-medium whitespace-nowrap outline-none',
        'transition-[background-color,color,opacity] duration-250',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
        !round && 'rounded-pill',
        phase === 'success'
          ? 'bg-emerald-600 text-white'
          : 'bg-primary text-primary-foreground shadow-xs',
        className,
      )}
    >
      <AnimatePresence mode='popLayout' initial={false}>
        <motion.span
          key={phase === 'error' ? 'idle' : phase}
          {...swap}
          className='inline-flex items-center justify-center gap-2 px-6'
        >
          {phase === 'busy' ? (
            <Loader2 className='size-5 animate-spin' aria-hidden />
          ) : phase === 'success' ? (
            <DrawnCheck reduced={!!reduced} />
          ) : (
            children
          )}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** A tick drawn in one stroke */
export function DrawnCheck({ reduced, className }: { reduced: boolean; className?: string }) {
  if (reduced) return <Check className={cn('size-5', className)} aria-hidden />
  return (
    <svg viewBox='0 0 24 24' className={cn('size-5', className)} fill='none' aria-hidden>
      <motion.path
        d='M5 12.5l4.5 4.5L19 7.5'
        stroke='currentColor'
        strokeWidth={2.6}
        strokeLinecap='round'
        strokeLinejoin='round'
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.slow, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}
