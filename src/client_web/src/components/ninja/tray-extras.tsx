import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Award, Loader2, Minus, NotebookPen, Plus, Tag, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { blurSwap, springOpen, springSoft } from '@/lib/motion'
import type { CheckoutExtras } from '@/lib/use-checkout-extras'
import { cn } from '@/lib/utils'
import { Odometer } from './odometer'
import { POINTS_STEP, promoReasonKey } from '@/components/cart/savings-model'

type Open = 'note' | 'promo' | 'points' | null

/**
 * The extras of an order, quiet until wanted: a row of small pills in the
 * tray's own colours (a note, a code, points), each saying what it holds
 * once set. A tap opens only that one's field under the row, and a tap
 * again (or on another) closes it; nothing stands open by itself.
 */
export function TrayExtras({ extras }: { extras: CheckoutExtras }) {
  const t = useT()
  const swap = blurSwap(useReducedMotion())
  const [open, setOpen] = useState<Open>(null)
  const toggle = (which: Exclude<Open, null>) => setOpen((o) => (o === which ? null : which))
  const { promo, points } = extras
  const promoOn = extras.promoDiscount > 0
  const pointsOn = extras.pointsDiscount > 0

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-wrap gap-2'>
        <Pill icon={NotebookPen} on={open === 'note'} set={extras.note.trim() !== ''} onClick={() => toggle('note')}>
          {extras.note.trim() ? <span className='max-w-28 truncate'>{extras.note.trim()}</span> : t('ninjaAddNote')}
        </Pill>
        <Pill icon={Tag} on={open === 'promo'} set={promoOn} onClick={() => toggle('promo')}>
          {promo.code ? (
            <span className={cn('font-mono tracking-wide', promo.reason && 'text-red-300 dark:text-red-600')}>
              {promo.code}
            </span>
          ) : (
            t('promoCode')
          )}
        </Pill>
        {points.offered && (
          <Pill icon={Award} on={open === 'points'} set={pointsOn} onClick={() => toggle('points')}>
            {pointsOn ? `${points.count} ${t('pts')}` : t('useLoyaltyPoints')}
          </Pill>
        )}
      </div>

      {/* One panel: it opens once, and moving to another pill swaps what is in it with a short blur rather than closing and opening again */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key='panel'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springSoft}
            className='overflow-hidden'
          >
            <AnimatePresence mode='wait' initial={false}>
            <motion.div key={open} {...swap} transition={{ duration: 0.14 }} className='pt-1'>
              {open === 'note' && (
                <textarea
                  autoFocus
                  rows={2}
                  value={extras.note}
                  onChange={(e) => extras.setNote(e.target.value)}
                  placeholder={t('orderNoteOptional')}
                  className='bg-background/10 placeholder:text-background/50 focus:bg-background/15 block w-full resize-none rounded-2xl px-4 py-3 text-base transition-colors outline-none md:text-sm'
                />
              )}
              {open === 'promo' && <PromoField extras={extras} onDone={() => setOpen(null)} />}
              {open === 'points' && <PointsField extras={extras} />}
            </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Why a code does not apply, said under the row whether its field is open or not */}
      <AnimatePresence initial={false}>
        {promo.code && promo.reason && (
          <motion.p key='reason' {...swap} className='px-1 text-xs text-red-300 dark:text-red-600'>
            {t(promoReasonKey(promo.reason))}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

function Pill({
  icon: Icon,
  on,
  set,
  onClick,
  children,
}: {
  icon: typeof Tag
  /** Its field is open */
  on: boolean
  /** It holds something that goes with the order */
  set: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      type='button'
      layout='position'
      transition={springOpen}
      whileTap={{ scale: 0.96 }}
      aria-expanded={on}
      onClick={onClick}
      className={cn(
        'flex h-9 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold whitespace-nowrap transition-colors duration-200',
        set ? 'bg-emerald-500/20 text-emerald-300 dark:text-emerald-700' : on ? 'bg-background/20' : 'bg-background/10 opacity-80'
      )}
    >
      <Icon className='size-3.5 shrink-0' />
      {children}
    </motion.button>
  )
}

/** The code, typed and applied in one line; applied, the pill carries it and here it can be taken off */
function PromoField({ extras, onDone }: { extras: CheckoutExtras; onDone: () => void }) {
  const t = useT()
  const [input, setInput] = useState('')
  const { promo } = extras
  if (promo.code) {
    return (
      <div className='bg-background/10 flex items-center gap-2 rounded-2xl px-4 py-2'>
        <span className='min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-wide'>{promo.code}</span>
        {promo.checking ? (
          <Loader2 className='size-4 animate-spin opacity-60' />
        ) : (
          <button type='button' aria-label={t('removePromo')} onClick={promo.clear} className='bg-background/15 grid size-8 place-items-center rounded-full'>
            <X className='size-4' />
          </button>
        )}
      </div>
    )
  }
  return (
    <form
      className='bg-background/10 focus-within:bg-background/15 flex items-center gap-2 rounded-2xl py-1.5 ps-4 pe-1.5 transition-colors'
      onSubmit={(e) => {
        e.preventDefault()
        const typed = input.trim().toUpperCase()
        if (!typed) return
        promo.apply(typed)
        onDone()
      }}
    >
      <input
        autoFocus
        placeholder={t('promoCode')}
        aria-label={t('promoCode')}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        autoCapitalize='characters'
        autoComplete='off'
        className='placeholder:text-background/50 h-9 min-w-0 flex-1 bg-transparent text-base uppercase outline-none placeholder:normal-case md:text-sm'
      />
      <button type='submit' disabled={!input.trim()} className='bg-background text-foreground h-9 shrink-0 rounded-full px-4 text-[13px] font-bold disabled:opacity-40'>
        {t('apply')}
      </button>
    </form>
  )
}

/**
 * Points off the order, in steps: less and more either side of how many,
 * the count and what it takes off rolling as it moves, and a way to use as
 * many as the order takes. None is the same as not using them.
 */
function PointsField({ extras }: { extras: CheckoutExtras }) {
  const t = useT()
  const { points } = extras
  const set = (count: number) => {
    const next = Math.max(0, Math.min(points.max, count))
    points.setCount(next)
    points.setActive(next > 0)
  }
  const all = points.count >= points.max
  return (
    <div className='bg-background/10 flex items-center gap-2 rounded-2xl p-1.5'>
      <button
        type='button'
        aria-label={t('ninjaLess')}
        disabled={points.count <= 0}
        onClick={() => set(points.count - POINTS_STEP)}
        className='bg-background/15 grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-30'
      >
        <Minus className='size-4' />
      </button>
      <span className='flex min-w-0 flex-1 flex-col items-center leading-tight'>
        <span className='text-sm font-bold'>
          <Odometer value={String(points.count)} /> {t('pts')}
        </span>
        <span className='text-[11px] tabular-nums opacity-60'>
          {t('ninjaPointsOf', { balance: String(points.balance) })}
        </span>
      </span>
      <button
        type='button'
        aria-label={t('ninjaMore')}
        disabled={all}
        onClick={() => set(points.count + POINTS_STEP)}
        className='bg-background/15 grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-30'
      >
        <Plus className='size-4' />
      </button>
      <button
        type='button'
        disabled={all}
        onClick={() => set(points.max)}
        className='bg-background text-foreground h-9 shrink-0 rounded-full px-3.5 text-[13px] font-bold disabled:opacity-40'
      >
        {t('ninjaUseAllPoints')}
      </button>
    </div>
  )
}
