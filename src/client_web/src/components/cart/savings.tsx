import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Award, Loader2, NotebookPen, Tag, X } from 'lucide-react'
import { blurSwap, springSoft } from '@/lib/motion'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { POINTS_STEP, promoReasonKey } from './savings-model'

/** A row of the extras panel: an icon, what it is, and whatever it holds; it opens under itself when it has more to show. */
function ExtraRow({ icon: Icon, children, more }: { icon: typeof Tag; children: ReactNode; more?: ReactNode }) {
  return (
    <div className='flex flex-col px-4 py-3'>
      <div className='flex min-h-9 items-center gap-3'>
        <span className='bg-muted grid size-9 shrink-0 place-items-center rounded-full'>
          <Icon className='size-4' />
        </span>
        {children}
      </div>
      <AnimatePresence initial={false}>
        {more && (
          <motion.div
            key='more'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springSoft}
            className='overflow-hidden'
          >
            <div className='pt-3'>{more}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** The note for the kitchen: a line to tap, which opens into the note itself */
export function NoteRow({ note, onNote }: { note: string; onNote: (note: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(note !== '')
  return (
    <ExtraRow
      icon={NotebookPen}
      more={
        open && (
          <textarea
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={t('orderNoteOptional')}
            className='bg-muted placeholder:text-muted-foreground focus-visible:ring-ring/50 w-full resize-none rounded-2xl px-4 py-3 text-base outline-none focus-visible:ring-[3px] md:text-sm'
          />
        )
      }
    >
      <button type='button' onClick={() => setOpen((o) => !o)} aria-expanded={open} className='min-w-0 flex-1 text-start text-[15px] font-medium'>
        {t('ninjaAddNote')}
      </button>
    </ExtraRow>
  )
}

/**
 * A promo code: typed and applied in one row, which then turns into the
 * code itself, with why it does not apply when it does not.
 */
export function PromoRow({
  code,
  reason,
  checking,
  onApply,
  onClear,
}: {
  code: string | null
  reason: string | null
  checking: boolean
  onApply: (code: string) => void
  onClear: () => void
}) {
  const t = useT()
  const reduced = useReducedMotion()
  const [input, setInput] = useState('')
  const swap = blurSwap(reduced)

  return (
    <ExtraRow icon={Tag}>
      <AnimatePresence mode='popLayout' initial={false}>
        {code ? (
          <motion.div key='applied' {...swap} className='flex min-w-0 flex-1 items-center gap-2'>
            <span className='flex min-w-0 flex-1 flex-col'>
              <span className={cn('truncate font-mono text-[15px] font-bold tracking-wide', reason ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>{code}</span>
              {reason && <span className='text-destructive text-xs'>{t(promoReasonKey(reason))}</span>}
            </span>
            {checking ? (
              <Loader2 className='text-muted-foreground size-4 animate-spin' />
            ) : (
              <button
                type='button'
                aria-label={t('removePromo')}
                onClick={() => {
                  setInput('')
                  onClear()
                }}
                className='bg-muted grid size-8 shrink-0 place-items-center rounded-full'
              >
                <X className='size-4' />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.form
            key='input'
            {...swap}
            className='flex min-w-0 flex-1 items-center gap-2'
            onSubmit={(e) => {
              e.preventDefault()
              const typed = input.trim().toUpperCase()
              if (typed) onApply(typed)
            }}
          >
            <input
              placeholder={t('promoCode')}
              aria-label={t('promoCode')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoCapitalize='characters'
              autoComplete='off'
              className='placeholder:text-muted-foreground h-9 min-w-0 flex-1 bg-transparent text-base uppercase outline-none placeholder:normal-case md:text-[15px]'
            />
            <AnimatePresence initial={false}>
              {input.trim() && (
                <motion.button
                  key='apply'
                  type='submit'
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={springSoft}
                  className='bg-foreground text-background h-8 shrink-0 rounded-full px-4 text-[13px] font-bold'
                >
                  {t('apply')}
                </motion.button>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </ExtraRow>
  )
}

/** Loyalty points against the order: a switch, then how many on a slider, the count rolling as it moves */
export function PointsRow({
  active,
  points,
  max,
  balance,
  onActive,
  onPoints,
}: {
  active: boolean
  points: number
  max: number
  balance: number
  onActive: (active: boolean) => void
  onPoints: (points: number) => void
}) {
  const t = useT()
  return (
    <ExtraRow
      icon={Award}
      more={
        active && (
          <div className='flex flex-col gap-3'>
            <Slider min={0} max={max} step={POINTS_STEP} value={[points]} onValueChange={([value]) => onPoints(value)} />
            <div className='flex items-baseline justify-between text-sm tabular-nums'>
              <span className='font-bold'>
                <Odometer value={String(points)} className='text-[15px]' /> {t('pts')}
              </span>
              <span className='text-muted-foreground text-xs'>
                {balance} {t('pts')}
              </span>
            </div>
          </div>
        )
      }
    >
      <span className='min-w-0 flex-1 text-[15px] font-medium'>{t('useLoyaltyPoints')}</span>
      <Switch checked={active} onCheckedChange={onActive} aria-label={t('useLoyaltyPoints')} />
    </ExtraRow>
  )
}
