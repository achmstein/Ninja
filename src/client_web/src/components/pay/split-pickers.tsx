import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, Loader2, UserRound, UserRoundCheck, UserRoundMinus, UserRoundPlus } from 'lucide-react'
import { currencyLabel, useCurrency } from '@/lib/currency'
import { useLanguage, usePrice, useT } from '@/lib/i18n'
import {
  customShare,
  equalShare,
  MAX_SEATS,
  money,
  pickedSeats,
  quickAmounts,
  seatPlan,
  sliderAmount,
  sliderPosition,
  sliderSteps,
} from '@/lib/pay'
import { spring, springSoft } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'
import { Slider } from '@/components/ui/slider'

type SeatKind = 'mine' | 'free' | 'held' | 'paid'

/**
 * Divide equally, told plainly: the guest's share big in the middle, the
 * bill as a bar cut into one piece per person, a stepper for how many are
 * at the table, and the people themselves as a row the guest taps to say
 * whose share they are covering (their own, "you", always first). Those
 * who look paid, or are paying now, sit at the end (a guess from the
 * money, and said to be one). The people picked are the parts, everyone
 * the whole: the same `parts` of `of` the server takes. People pop in and
 * out as the table grows, the bar re-cuts itself and the sums roll.
 */
export function SeatsTable({
  total,
  remaining,
  paid,
  held,
  seats,
  minSeats,
  selected,
  onSeats,
  onToggle,
}: {
  total: number
  remaining: number
  paid: number
  held: number
  seats: number
  minSeats: number
  selected: ReadonlySet<number>
  onSeats: (n: number) => void
  onToggle: (seat: number) => void
}) {
  const t = useT()
  const price = usePrice()
  const reduced = useReducedMotion()
  const language = useLanguage((s) => s.language)
  const currency = useCurrency((s) => s.code)
  const plan = seatPlan(total, paid, held, seats)
  const mine = pickedSeats(selected, plan.free)
  const share = equalShare(total, remaining, mine.length, seats)
  const left = money(Math.max(0, remaining - share))
  const kinds: SeatKind[] = Array.from({ length: seats }, (_, i) =>
    i < plan.free ? (mine.includes(i) ? 'mine' : 'free') : i < plan.free + plan.held ? 'held' : 'paid'
  )
  const pop = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.4 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.4 } }

  const stepper = (dir: -1 | 1) => (
    <motion.button
      type='button'
      whileTap={reduced ? undefined : { scale: 0.88 }}
      transition={spring}
      aria-label={t(dir < 0 ? 'removeSeat' : 'addSeat')}
      disabled={dir < 0 ? seats <= minSeats : seats >= MAX_SEATS}
      onClick={() => onSeats(seats + dir)}
      className='bg-background text-foreground focus-visible:ring-ring/50 grid size-12 shrink-0 place-items-center rounded-full shadow-sm outline-none focus-visible:ring-4 disabled:opacity-35 disabled:shadow-none'
    >
      {dir < 0 ? <UserRoundMinus className='size-5' /> : <UserRoundPlus className='size-5' />}
    </motion.button>
  )

  return (
    <div className='flex flex-col gap-4'>
      <div className='bg-muted flex flex-col items-center gap-4 rounded-[1.75rem] px-4 pt-5 pb-4'>
        {/* What this guest pays, the one big number */}
        <div className='flex flex-col items-center gap-1 text-center'>
          <span className='text-muted-foreground text-caption font-semibold'>
            {mine.length > 1 ? t('youPayForSeats', { parts: mine.length, of: seats }) : t('yourShare')}
          </span>
          <span className='flex items-baseline justify-center gap-1.5' aria-live='polite'>
            <Odometer value={share.toFixed(2)} className='text-display-lg font-bold' />
            <span className='text-muted-foreground text-name font-semibold'>{currencyLabel(currency, language)}</span>
          </span>
          <span className='text-muted-foreground text-caption tabular-nums'>
            {t('splitMath', { total: total.toFixed(2), n: seats, each: plan.perPerson.toFixed(2) })}
          </span>
        </div>

        {/* The bill, cut into one piece per person: the guest's pieces lit,
            the paid ones green, the ones being paid amber */}
        <div aria-hidden className='flex h-2.5 w-full gap-1'>
          <AnimatePresence initial={false}>
            {kinds.map((kind, i) => (
              <motion.span
                key={i}
                initial={reduced ? { flexGrow: 1, opacity: 0 } : { flexGrow: 0, opacity: 0 }}
                animate={{ flexGrow: 1, opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { flexGrow: 0, opacity: 0 }}
                transition={springSoft}
                className={cn(
                  'min-w-0 basis-0 rounded-full transition-colors duration-300',
                  kind === 'mine' && 'bg-foreground',
                  kind === 'free' && 'bg-foreground/15',
                  kind === 'held' && 'bg-amber-400',
                  kind === 'paid' && 'bg-emerald-500'
                )}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* How many at the table */}
        <div className='flex w-full items-center justify-between gap-2'>
          {stepper(-1)}
          <div className='flex flex-col items-center leading-none' aria-live='polite'>
            <span className='sr-only'>{t('peopleAtTable', { count: seats })}</span>
            <span aria-hidden className='flex items-baseline gap-1.5'>
              <Odometer value={String(seats)} className='text-display font-bold' />
              <span className='text-name font-semibold'>{t('peopleUnit', { count: seats })}</span>
            </span>
            <span aria-hidden className='text-muted-foreground mt-1 text-caption'>
              {t('onTheTable')}
            </span>
          </div>
          {stepper(1)}
        </div>
      </div>

      {/* The people: tap the ones you are paying for */}
      <div className='flex flex-col gap-3'>
        <span className='px-1 text-caption font-semibold'>{t('whoYouPayFor')}</span>
        <div className='flex flex-wrap justify-center gap-x-2 gap-y-3'>
          <AnimatePresence initial={false} mode='popLayout'>
            {kinds.map((kind, i) => {
              const first = kind === 'mine' && i === mine[0]
              const label =
                kind === 'paid'
                  ? t('seatPaid')
                  : kind === 'held'
                    ? t('lineBeingPaid')
                    : t(kind === 'mine' ? 'seatYours' : 'seatFree', { n: i + 1 })
              return (
                <motion.div key={i} layout={!reduced} {...pop} transition={springSoft} className='flex w-12 flex-col items-center gap-1'>
                  <motion.button
                    type='button'
                    whileTap={reduced || (kind !== 'free' && kind !== 'mine') ? undefined : { scale: 0.88 }}
                    transition={spring}
                    title={label}
                    aria-label={label}
                    aria-pressed={kind === 'free' || kind === 'mine' ? kind === 'mine' : undefined}
                    disabled={kind === 'held' || kind === 'paid'}
                    onClick={() => onToggle(i)}
                    className={cn(
                      'relative grid size-12 place-items-center rounded-full border-2 text-caption font-bold',
                      'focus-visible:ring-ring/50 transition-[background-color,border-color,color,box-shadow] duration-200 outline-none focus-visible:ring-4',
                      kind === 'paid' && 'border-emerald-500 bg-emerald-500 text-white',
                      kind === 'held' && 'border-dashed border-amber-400 text-amber-500',
                      kind === 'mine' && 'border-foreground bg-foreground text-background shadow-[0_6px_16px_-6px_rgb(0_0_0/0.45)]',
                      kind === 'free' && 'border-foreground/20 text-muted-foreground hover:border-foreground/45 border-dashed'
                    )}
                  >
                    {kind === 'paid' ? (
                      <Check className='size-5' strokeWidth={3} />
                    ) : kind === 'held' ? (
                      <Loader2 className='size-4 animate-spin motion-reduce:animate-none' />
                    ) : first ? (
                      t('seatYou')
                    ) : kind === 'mine' ? (
                      <UserRoundCheck className='size-5' />
                    ) : (
                      <UserRound className='size-5' />
                    )}
                  </motion.button>
                  <span
                    aria-hidden
                    className={cn(
                      'w-full truncate text-center text-micro font-medium',
                      kind === 'mine' ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {kind === 'paid'
                      ? t('personPaid')
                      : kind === 'held'
                        ? t('personPaying')
                        : plan.perPerson.toFixed(2)}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        <div className='flex flex-col items-center gap-0.5 text-center'>
          <p className='text-muted-foreground text-caption tabular-nums'>{t('leftAfterYou', { amount: price(left) })}</p>
          {(plan.paid > 0 || plan.held > 0 || plan.free > 1) && (
            <p className='text-muted-foreground text-caption'>{t('seatsHint')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Custom amount: a big figure the guest can type into, a slider from
 * nothing to what is left, and chips for the usual choices. The slider
 * cannot go past what is left, and a typed sum past it is brought back.
 */
export function AmountPicker({
  remaining,
  text,
  onText,
}: {
  remaining: number
  text: string
  onText: (text: string) => void
}) {
  const t = useT()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const currency = useCurrency((s) => s.code)
  const [clamped, setClamped] = useState(false)
  const amount = Math.min(customShare(text), remaining)
  const left = money(Math.max(0, remaining - amount))
  const chips = quickAmounts(remaining)
  const fractions = chips.filter((c) => c.label !== null || c.key === 'all')
  const rounds = chips.filter((c) => c.label === null && c.key !== 'all')

  const set = (value: number) => {
    setClamped(false)
    onText(value > 0 ? String(money(value)) : '')
  }

  const type = (raw: string) => {
    // Digits and one separator only; Arabic digits are read by customShare
    const cleaned = raw.replace(/[^0-9٠-٩.,٫]/g, '').replace('٫', '.')
    if (customShare(cleaned) > remaining) {
      setClamped(true)
      onText(String(money(remaining)))
      return
    }
    setClamped(false)
    onText(cleaned)
  }

  const chip = (key: string, label: string, value: number, big = false) => {
    const active = amount > 0 && value === amount
    return (
      <button
        key={key}
        type='button'
        aria-pressed={active}
        onClick={() => set(value)}
        className={cn(
          'min-h-10 rounded-full border px-3 font-semibold tabular-nums transition-[background-color,border-color,color,scale] duration-200 active:scale-[0.96] motion-reduce:transform-none',
          big ? 'text-headline leading-none' : 'text-caption',
          active ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent'
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <span className='px-1 text-caption font-semibold'>{t('chooseAmount')}</span>

      {/* The figure is drawn big; the input over it takes the typing
          (phones keep inputs at 16px so they never zoom) */}
      <label className='bg-muted group focus-within:ring-ring/50 relative flex cursor-text flex-col items-center gap-1 rounded-[1.5rem] px-4 pt-3 pb-4 transition-shadow focus-within:ring-[3px]'>
        <span className='text-muted-foreground text-caption'>{t('tapToType')}</span>
        <input
          inputMode='decimal'
          autoComplete='off'
          enterKeyHint='done'
          aria-label={t('amountToPay')}
          value={text}
          onChange={(e) => type(e.target.value)}
          className='absolute inset-0 h-full w-full cursor-text rounded-[1.5rem] opacity-0'
        />
        <span
          aria-hidden
          className='flex max-w-full items-baseline justify-center gap-1.5'
        >
          <span
            className={cn(
              'truncate text-display-lg font-bold tabular-nums',
              !text && 'text-muted-foreground/50'
            )}
          >
            {text || '0'}
          </span>
          <span className='bg-primary hidden h-7 w-0.5 animate-pulse self-center rounded-full group-focus-within:block motion-reduce:animate-none' />
          <span className='text-muted-foreground text-name font-semibold'>
            {currencyLabel(currency, language)}
          </span>
        </span>
      </label>

      <div className='flex flex-col gap-2 px-1'>
        <Slider
          min={0}
          max={sliderSteps(remaining)}
          step={1}
          value={[sliderPosition(amount, remaining)]}
          onValueChange={([step]) => set(sliderAmount(step, remaining))}
          aria-label={t('amountToPay')}
          className='py-2 [&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-track]]:h-2'
        />
        <div className='text-muted-foreground flex justify-between text-caption tabular-nums'>
          <span>{price(0)}</span>
          <span>{price(remaining)}</span>
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <div className='grid grid-cols-4 gap-2'>
          {fractions.map((c) =>
            c.key === 'all'
              ? chip(c.key, t('all'), c.amount)
              : chip(c.key, c.label ?? '', c.amount, true)
          )}
        </div>
        {rounds.length > 0 && (
          <div
            className='grid gap-2'
            style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}
          >
            {rounds.map((c) => chip(c.key, price.whole(c.amount), c.amount))}
          </div>
        )}
      </div>

      <p
        className={cn(
          'text-center text-caption tabular-nums',
          clamped ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
        )}
        aria-live='polite'
      >
        {clamped
          ? t('customAmountClamped', { amount: price(remaining) })
          : t('leftAfterYou', { amount: price(left) })}
      </p>
    </div>
  )
}
