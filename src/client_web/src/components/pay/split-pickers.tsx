import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Check, Loader2, Minus, Plus } from 'lucide-react'
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

/** The table's drawing: a square this wide, the table in the middle and
 *  the seats around it. Fits a 360px phone with the sheet's padding. */
const BOX = 248
const TABLE = 136
const SEAT = 44
const ORBIT = (BOX - SEAT) / 2

/**
 * Divide equally, drawn as the table: seats around it, the per-person
 * price in the middle, the seats paid or being paid filled in (a guess
 * from the money, and said to be one), and the guest taps the seats
 * they are paying for. The seats picked are the parts, the seats the
 * whole: the same `parts` of `of` the server takes. Seats glide round
 * the table on a spring as it grows, and the per-person sum rolls.
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
  const rtl = language === 'ar'
  const plan = seatPlan(total, paid, held, seats)
  const mine = pickedSeats(selected, plan.free)
  const share = equalShare(total, remaining, mine.length, seats)
  const left = money(Math.max(0, remaining - share))

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between gap-2'>
        <span className='px-1 text-[13px] font-semibold'>{t('seatsAtTable')}</span>
        <div className='bg-muted flex items-center rounded-full p-1'>
          <motion.button
            type='button'
            whileTap={reduced ? undefined : { scale: 0.85 }}
            transition={spring}
            className='grid size-9 place-items-center rounded-full disabled:opacity-40'
            aria-label={t('removeSeat')}
            disabled={seats <= minSeats}
            onClick={() => onSeats(seats - 1)}
          >
            <Minus className='size-4' />
          </motion.button>
          <span className='w-8 text-center' aria-live='polite'>
            <Odometer value={String(seats)} className='text-[15px] font-bold' />
          </span>
          <motion.button
            type='button'
            whileTap={reduced ? undefined : { scale: 0.85 }}
            transition={spring}
            className='grid size-9 place-items-center rounded-full disabled:opacity-40'
            aria-label={t('addSeat')}
            disabled={seats >= MAX_SEATS}
            onClick={() => onSeats(seats + 1)}
          >
            <Plus className='size-4' />
          </motion.button>
        </div>
      </div>

      <div className='relative mx-auto' style={{ width: BOX, height: BOX }}>
        {/* The table */}
        <div
          className='surface absolute flex flex-col items-center justify-center rounded-full'
          style={{
            width: TABLE,
            height: TABLE,
            top: (BOX - TABLE) / 2,
            left: (BOX - TABLE) / 2,
          }}
        >
          <span className='text-muted-foreground text-[11px] font-medium'>
            {t('perPerson')}
          </span>
          <Odometer value={plan.perPerson.toFixed(2)} className='text-[20px] font-extrabold' />
          <span className='text-muted-foreground text-xs font-semibold'>
            {currencyLabel(currency, language)}
          </span>
        </div>

        {Array.from({ length: seats }, (_, i) => {
          // From the guest's side of the table (the bottom), round the
          // way the page reads: clockwise in English, the other way in Arabic
          const angle = Math.PI / 2 + ((rtl ? -1 : 1) * 2 * Math.PI * i) / seats
          const x = ORBIT + ORBIT * Math.cos(angle)
          const y = ORBIT + ORBIT * Math.sin(angle)
          const kind: 'free' | 'held' | 'paid' =
            i < plan.free ? 'free' : i < plan.free + plan.held ? 'held' : 'paid'
          const picked = kind === 'free' && mine.includes(i)
          const first = picked && i === mine[0]
          const label =
            kind === 'paid'
              ? t('seatPaid')
              : kind === 'held'
                ? t('lineBeingPaid')
                : t(picked ? 'seatYours' : 'seatFree', { n: i + 1 })

          return (
            // Placed with a transform so seats glide round when the table grows
            <motion.div
              key={i}
              className='absolute top-0 left-0'
              initial={reduced ? { x, y, opacity: 0 } : { x: ORBIT, y: ORBIT, opacity: 0, scale: 0.5 }}
              animate={{ x, y, opacity: 1, scale: 1 }}
              transition={springSoft}
            >
              <motion.button
                whileTap={reduced || kind !== 'free' ? undefined : { scale: 0.9 }}
                type='button'
                title={label}
                aria-label={label}
                aria-pressed={kind === 'free' ? picked : undefined}
                disabled={kind !== 'free'}
                onClick={() => onToggle(i)}
                className={cn(
                  'flex items-center justify-center rounded-full border-2 text-xs font-bold',
                  'focus-visible:ring-ring/50 transition-colors duration-200 outline-none focus-visible:ring-4',
                  kind === 'paid' && 'border-emerald-500 bg-emerald-500 text-white',
                  kind === 'held' && 'border-dashed border-amber-400 text-amber-500',
                  kind === 'free' &&
                    (picked
                      ? 'border-foreground bg-foreground text-background shadow-md'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/40')
                )}
                style={{ width: SEAT, height: SEAT }}
              >
                {kind === 'paid' ? (
                  <Check className='h-5 w-5' strokeWidth={3} />
                ) : kind === 'held' ? (
                  <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
                ) : picked ? (
                  first ? (
                    t('seatYou')
                  ) : (
                    <span dir='ltr'>+1</span>
                  )
                ) : (
                  <Plus className='h-4 w-4 opacity-60' />
                )}
              </motion.button>
            </motion.div>
          )
        })}
      </div>

      <div className='flex flex-col items-center gap-0.5 text-center'>
        <p className='text-[15px] font-semibold tabular-nums'>
          {t('youPayForSeats', { parts: mine.length, of: seats })}
          <span className='text-muted-foreground'> · </span>
          <Odometer value={price(share)} className='text-[15px] font-bold' />
        </p>
        <p className='text-muted-foreground text-[13px] tabular-nums'>
          {t('leftAfterYou', { amount: price(left) })}
        </p>
        {(plan.paid > 0 || plan.held > 0 || plan.free > 1) && (
          <p className='text-muted-foreground mt-1 text-xs'>{t('seatsHint')}</p>
        )}
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
          big ? 'text-lg leading-none' : 'text-[13px]',
          active ? 'border-foreground bg-foreground text-background' : 'hover:bg-accent'
        )}
      >
        {label}
      </button>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <span className='px-1 text-[13px] font-semibold'>{t('chooseAmount')}</span>

      {/* The figure is drawn big; the input over it takes the typing
          (phones keep inputs at 16px so they never zoom) */}
      <label className='bg-muted group focus-within:ring-ring/50 relative flex cursor-text flex-col items-center gap-1 rounded-[1.5rem] px-4 pt-3 pb-4 transition-shadow focus-within:ring-[3px]'>
        <span className='text-muted-foreground text-xs'>{t('tapToType')}</span>
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
              'truncate text-4xl font-bold tabular-nums',
              !text && 'text-muted-foreground/50'
            )}
          >
            {text || '0'}
          </span>
          <span className='bg-primary hidden h-7 w-0.5 animate-pulse self-center rounded-full group-focus-within:block motion-reduce:animate-none' />
          <span className='text-muted-foreground text-base font-semibold'>
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
        <div className='text-muted-foreground flex justify-between text-xs tabular-nums'>
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
          'text-center text-[13px] tabular-nums',
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
