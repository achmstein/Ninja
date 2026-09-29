import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Hourglass, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { blurSwap, spring } from '@/lib/motion'
import { type RequestState } from '@/lib/service-requests'
import { cn } from '@/lib/utils'

/**
 * One thing to ask the staff for, from a table or a room, as a tile that is
 * also its status: tap to send, tap again to take it back while it is only
 * sent, then on the way (with who is coming) once the till picks it up. The
 * open request is the cooldown; the tile says so, no toast asks anyone to
 * wait. The icon and the status line swap with a short blur.
 */
export function RequestTile({
  icon: Icon,
  label,
  state,
  locked = false,
  busy = false,
  onTap,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  state: RequestState
  /** Nothing goes out (a table not vouched for yet) */
  locked?: boolean
  /** Another request is on its way out */
  busy?: boolean
  onTap: () => void
}) {
  const t = useT()
  const swap = blurSwap(useReducedMotion())
  const { phase } = state
  const disabled = locked || busy || phase === 'sending' || phase === 'onTheWay'
  const note =
    phase === 'sent'
      ? t('sent')
      : phase === 'onTheWay'
        ? state.by
          ? t('onTheWayBy', { name: state.by })
          : t('onTheWay')
        : null

  return (
    <motion.button
      type='button'
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={spring}
      disabled={disabled}
      onClick={onTap}
      className={cn(
        'flex min-h-24 flex-col items-start justify-between gap-3 rounded-[1.5rem] p-4 text-start transition-colors duration-300 disabled:cursor-default',
        phase === 'onTheWay' ? 'bg-emerald-500/15' : phase === 'sent' ? 'bg-primary/12' : 'bg-muted',
        locked && 'opacity-50'
      )}
    >
      <span
        className={cn(
          'grid size-10 place-items-center rounded-full transition-colors duration-300',
          phase === 'onTheWay' ? 'bg-emerald-500 text-white' : phase === 'sent' ? 'bg-primary text-primary-foreground' : 'bg-background text-foreground'
        )}
      >
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.span key={phase} {...swap} className='grid place-items-center'>
            {phase === 'sending' ? (
              <Loader2 className='size-5 animate-spin' />
            ) : phase === 'sent' ? (
              <Hourglass className='size-5' />
            ) : phase === 'onTheWay' ? (
              <Check className='size-5' />
            ) : (
              <Icon className='size-5' />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
      {/* A third of a phone is narrow: the status wraps rather than spills, and
          the way to take it back sits on a line of its own, a size down */}
      <span className='flex w-full min-w-0 flex-col'>
        <span className='text-note leading-snug font-semibold'>{label}</span>
        <AnimatePresence mode='popLayout' initial={false}>
          {note && (
            <motion.span key={note} {...swap} className='text-muted-foreground flex flex-col text-caption text-balance break-words'>
              <span>{note}</span>
              {phase === 'sent' && <span className='text-micro'>{t('tapToCancel')}</span>}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  )
}
