import { useEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { spring, springOpen, springSoft } from '@/lib/motion'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { canHold, hasOptions, PlaceIcon, placeCardId, placeNameId, placeStatusMeta, tariffOptions } from '@/lib/places'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { HoldForm } from './hold-form'

/**
 * One bookable place as a big card, the way the menu's deck shows a dish: a
 * free one on the café's colour with its name set large and its kind drawn
 * big behind it, a busy one quiet on a light card. A tap on a free one
 * grows the card and slides the booking in beneath its face, the way a
 * dish opens into its options; a second tap folds it away.
 */
export function PlaceCard({
  place,
  canReserve,
  open,
  onToggle,
  onDone,
  handedOver = false,
}: {
  place: PlaceViewModel
  /** Signed in, no hold already, reservations on */
  canReserve: boolean
  open: boolean
  onToggle: (place: PlaceViewModel) => void
  /** The booking under the card went through or was turned down */
  onDone: (outcome: 'booked' | 'failed') => void
  /** The reservation has opened out of this card: what the card held (the form and its tick) goes at once, so none of it shows through the crossfade */
  handedOver?: boolean
}) {
  const t = useT()
  const localized = useLocalized()
  const reduced = useReducedMotion()
  const card = useRef<HTMLElement>(null)

  const free = canHold(place)
  const tappable = free && canReserve
  const status = placeStatusMeta[Number(place.status ?? 0)] ?? placeStatusMeta[1]

  // An opened card near the bottom brings its booking into view
  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => card.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' }), 180)
    return () => window.clearTimeout(timer)
  }, [open, reduced])

  return (
    <motion.article
      ref={card}
      // The reservation opens out of this card and closes back into it (components/places/reservation)
      layoutId={placeCardId(place.id)}
      layoutCrossfade={false}
      layout
      transition={springOpen}
      style={{ borderRadius: 28 }}
      className={cn(
        'relative isolate overflow-hidden',
        free ? 'bg-primary text-primary-foreground shadow-[0_12px_32px_-14px_rgb(0_0_0/0.45)]' : 'surface text-foreground'
      )}
    >
      <motion.button
        layout='position'
        type='button'
        disabled={!tappable}
        aria-expanded={tappable ? open : undefined}
        onClick={() => onToggle(place)}
        whileTap={tappable && !open ? { scale: 0.98 } : undefined}
        transition={spring}
        className='relative flex min-h-44 w-full flex-col justify-between gap-4 p-5 text-start disabled:cursor-default'
      >
        {/* The place's kind, drawn big and faint behind its name */}
        <PlaceIcon
          kind={Number(place.kind)}
          className={cn('pointer-events-none absolute -end-6 -bottom-8 -z-10 size-44 -rotate-12', free ? 'opacity-[0.12]' : 'opacity-[0.06]')}
        />

        <span className='flex w-full items-center justify-between gap-3'>
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
              free ? 'bg-primary-foreground/15' : cn('bg-muted', status.className)
            )}
          >
            <span className={cn('size-1.5 rounded-full', free ? 'animate-pulse bg-emerald-400 motion-reduce:animate-none' : 'bg-current')} />
            {t(status.key)}
          </span>
          {tappable && (
            <motion.span
              aria-hidden
              animate={{ rotate: open ? 45 : 0 }}
              transition={spring}
              className='bg-primary-foreground text-primary grid size-10 shrink-0 place-items-center rounded-full'
            >
              <Plus className='size-5' strokeWidth={2.5} />
            </motion.span>
          )}
        </span>

        <span className='flex flex-col gap-1.5'>
          {/* The name travels into the reservation, the way a dish's photo stays on screen as it opens */}
          <motion.span layoutId={placeNameId(place.id)} transition={springOpen} className='heading w-fit text-[calc(2rem*var(--heading-scale))] leading-[1.05] break-words'>
            {localized(place.name)}
          </motion.span>
          {place.description && (
            <span className={cn('line-clamp-2 max-w-[34ch] text-sm', free ? 'opacity-80' : 'text-muted-foreground')}>
              {localized(place.description)}
            </span>
          )}
          <RateChips place={place} free={free} />
        </span>
      </motion.button>

      {/* The booking, beneath the card's face */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key='hold'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
            transition={springSoft}
            className='overflow-hidden'
          >
            <div className={cn('bg-background text-foreground m-1.5 mt-0 rounded-[1.4rem] p-4', handedOver && 'invisible')}>
              <HoldForm place={place} onDone={onDone} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

/** The rates as small chips: one for a one-rate place, one per option when there is a choice */
function RateChips({ place, free }: { place: PlaceViewModel; free: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const options = tariffOptions(place.tariff)
  if (options.length === 0) return null
  const chip = cn('rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums', free ? 'bg-primary-foreground/12' : 'bg-muted')
  return (
    <span className='mt-1 flex flex-wrap items-center gap-1.5'>
      {hasOptions(place.tariff) ? (
        <>
          {options.map((o) => (
            <span key={o.code} className={chip}>
              {t('optionRateFormat', { option: localized(o.name), rate: price.whole(o.hourlyRate) })}
            </span>
          ))}
          <span className={cn('text-xs font-medium', free ? 'opacity-70' : 'text-muted-foreground')}>{t('perHourShort')}</span>
        </>
      ) : (
        <span className={chip}>{t('hourlyRateFormat', { rate: price.whole(options[0].hourlyRate) })}</span>
      )}
    </span>
  )
}

/** The rate: one figure for a one-rate place, one per option when there is
 *  a choice ("Single 50 EGP · Multi 80 EGP /hr"). */
export function TariffLine({ place }: { place: Pick<PlaceViewModel, 'tariff'> }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const options = tariffOptions(place.tariff)
  if (options.length === 0) return null
  if (!hasOptions(place.tariff)) {
    return <>{t('hourlyRateFormat', { rate: price.whole(options[0].hourlyRate) })}</>
  }
  return (
    <>
      {options.map((o) => t('optionRateFormat', { option: localized(o.name), rate: price.whole(o.hourlyRate) })).join(' · ')}{' '}
      {t('perHourShort')}
    </>
  )
}

/** Loading placeholder for PlaceCard, at its size so nothing jumps when the places arrive */
export function PlaceCardSkeleton() {
  return (
    <div className='surface flex min-h-44 flex-col justify-between rounded-[1.75rem] p-5'>
      <Skeleton className='h-6 w-24 rounded-full' />
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-4 w-3/4' />
        <Skeleton className='h-6 w-32 rounded-full' />
      </div>
    </div>
  )
}
