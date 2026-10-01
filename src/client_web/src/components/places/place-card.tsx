import { useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Plus } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { spring, springOpen, springSoft } from '@/lib/motion'
import { useLocalized, usePrice, useT } from '@/lib/i18n'
import { canHold, hasOptions, PlaceIcon, placeCardId, placeNameId, placeStatusMeta, tariffOptions } from '@/lib/places'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { HoldForm } from './hold-form'
import type { PlacesStyle } from './places-style'

/** Room kept at the bottom for the dock (its tabs and a bill's row) and the phone's home bar, px */
const DOCK_ROOM = 150

/** Room kept above a card being brought into view, px */
const TOP_ROOM = 16

/**
 * One bookable place as a big card, the way the menu's deck shows a dish: a
 * free one on the business's colour with its name set large and its kind drawn
 * big behind it, a busy one quiet on a light card. A tap on a free one
 * grows the card and slides the booking in beneath its face, the way a
 * dish opens into its options; a second tap folds it away. Where the
 * business lists many places it is a slim row (`list`) or a small tile
 * (`grid`) instead, opening the same way.
 */
export function PlaceCard({
  place,
  canReserve,
  open,
  onToggle,
  onDone,
  handedOver = false,
  look = 'cards',
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
  /** The face: a big card, a slim row or a small tile */
  look?: PlacesStyle
}) {
  const t = useT()
  const localized = useLocalized()
  const reduced = useReducedMotion()
  const card = useRef<HTMLElement>(null)

  const free = canHold(place)
  const tappable = free && canReserve
  const status = placeStatusMeta[Number(place.status ?? 0)] ?? placeStatusMeta[1]

  // Once the booking has slid open, the page scrolls it into view above the dock: the customer
  // should not have to find it under their thumb, or below the screen's edge
  const reveal = () => {
    const el = card.current
    if (!el || !open) return
    const box = el.getBoundingClientRect()
    const below = box.bottom - (window.innerHeight - DOCK_ROOM)
    // As far as needed to show the form's end, never so far that the card's own top leaves the screen
    const by = Math.min(below, box.top - TOP_ROOM)
    if (by > 0) window.scrollBy({ top: by, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <motion.article
      ref={card}
      // The reservation opens out of this card and closes back into it (components/places/reservation)
      layoutId={placeCardId(place.id)}
      layoutCrossfade={false}
      layout
      transition={springOpen}
      style={{ borderRadius: look === 'list' ? 20 : look === 'grid' ? 24 : 28 }}
      className={cn(
        'relative isolate overflow-hidden',
        // A row is light whether free or not: its plus says it can be booked, where a whole list on the slab would shout
        free && look !== 'list' ? 'slab shadow-(--slab-shadow)' : 'surface text-foreground'
      )}
    >
      {look === 'list' ? (
        <PlaceRow place={place} tappable={tappable} open={open} onToggle={onToggle} />
      ) : look === 'grid' ? (
        <PlaceTile place={place} free={free} tappable={tappable} open={open} onToggle={onToggle} />
      ) : (
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
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-bold',
              free ? 'bg-emerald-400/20 text-emerald-300' : cn('bg-muted', status.className)
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
              className='bg-background text-foreground grid size-10 shrink-0 place-items-center rounded-full'
            >
              <Plus className='size-5' strokeWidth={2.5} />
            </motion.span>
          )}
        </span>

        <span className='flex flex-col gap-1.5'>
          {/* The name travels into the reservation, the way a dish's photo stays on screen as it opens */}
          <motion.span layoutId={placeNameId(place.id)} transition={springOpen} className='heading text-title w-fit break-words'>
            {localized(place.name)}
          </motion.span>
          {place.description && (
            <span className={cn('line-clamp-2 max-w-[34ch] text-note', free ? 'opacity-80' : 'text-muted-foreground')}>
              {localized(place.description)}
            </span>
          )}
          <RateChips place={place} free={free} />
        </span>
      </motion.button>
      )}

      {/* The booking, beneath the card's face */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key='hold'
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
            transition={springSoft}
            onAnimationComplete={reveal}
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

/** The plus that opens the booking, turning to a cross while it is open */
function OpenToggle({ open, className }: { open: boolean; className: string }) {
  return (
    <motion.span
      aria-hidden
      animate={{ rotate: open ? 45 : 0 }}
      transition={spring}
      className={cn('grid shrink-0 place-items-center rounded-full', className)}
    >
      <Plus className='size-4' strokeWidth={2.5} />
    </motion.span>
  )
}

type FaceProps = {
  place: PlaceViewModel
  tappable: boolean
  open: boolean
  onToggle: (place: PlaceViewModel) => void
}

/** The place as a slim row: its kind in a square, the name over where it stands and its rate, the plus at the end */
function PlaceRow({ place, tappable, open, onToggle }: FaceProps) {
  const t = useT()
  const localized = useLocalized()
  const status = placeStatusMeta[Number(place.status ?? 0)] ?? placeStatusMeta[1]
  return (
    <motion.button
      layout='position'
      type='button'
      disabled={!tappable}
      aria-expanded={tappable ? open : undefined}
      onClick={() => onToggle(place)}
      whileTap={tappable && !open ? { scale: 0.98 } : undefined}
      transition={spring}
      className='flex min-h-16 w-full items-center gap-3 p-3 text-start disabled:cursor-default'
    >
      <span className='bg-muted grid size-11 shrink-0 place-items-center rounded-2xl'>
        <PlaceIcon kind={Number(place.kind)} className='size-5' />
      </span>
      <span className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <motion.span layoutId={placeNameId(place.id)} transition={springOpen} className='heading w-fit max-w-full truncate text-lg leading-tight'>
          {localized(place.name)}
        </motion.span>
        <span className='text-muted-foreground flex min-w-0 items-center gap-1.5 text-caption'>
          <span className={cn('flex shrink-0 items-center gap-1.5 font-semibold', status.className)}>
            <span className='size-1.5 rounded-full bg-current' />
            {t(status.key)}
          </span>
          {tariffOptions(place.tariff).length > 0 && (
            <span className='truncate tabular-nums'>
              {'· '}
              <TariffLine place={place} />
            </span>
          )}
        </span>
      </span>
      {tappable && <OpenToggle open={open} className='slab size-9' />}
    </motion.button>
  )
}

/** The place as a small tile, two a row: where it stands and the plus on top, the name and its rate under, its kind faint behind */
function PlaceTile({ place, free, tappable, open, onToggle }: FaceProps & { free: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const status = placeStatusMeta[Number(place.status ?? 0)] ?? placeStatusMeta[1]
  return (
    <motion.button
      layout='position'
      type='button'
      disabled={!tappable}
      aria-expanded={tappable ? open : undefined}
      onClick={() => onToggle(place)}
      whileTap={tappable && !open ? { scale: 0.97 } : undefined}
      transition={spring}
      className='relative flex min-h-31 w-full flex-col justify-between gap-3 p-4 text-start disabled:cursor-default'
    >
      <PlaceIcon
        kind={Number(place.kind)}
        className={cn('pointer-events-none absolute -end-4 -bottom-5 -z-10 size-24 -rotate-12', free ? 'opacity-[0.12]' : 'opacity-[0.06]')}
      />
      <span className='flex w-full items-center justify-between gap-2'>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-caption font-bold',
            free ? 'bg-emerald-400/20 text-emerald-300' : cn('bg-muted', status.className)
          )}
        >
          <span className={cn('size-1.5 shrink-0 rounded-full', free ? 'animate-pulse bg-emerald-400 motion-reduce:animate-none' : 'bg-current')} />
          <span className='truncate'>{t(status.key)}</span>
        </span>
        {tappable && <OpenToggle open={open} className='bg-background text-foreground size-8' />}
      </span>
      <span className='flex min-w-0 flex-col gap-1'>
        <motion.span layoutId={placeNameId(place.id)} transition={springOpen} className='heading line-clamp-2 w-fit text-lg leading-tight break-words'>
          {localized(place.name)}
        </motion.span>
        {tariffOptions(place.tariff).length > 0 && (
          <span className={cn('truncate text-caption tabular-nums', free ? 'opacity-75' : 'text-muted-foreground')}>
            <TariffLine place={place} />
          </span>
        )}
      </span>
    </motion.button>
  )
}

/** The rates as small chips: one for a one-rate place, one per option when there is a choice */
function RateChips({ place, free }: { place: PlaceViewModel; free: boolean }) {
  const t = useT()
  const localized = useLocalized()
  const price = usePrice()
  const options = tariffOptions(place.tariff)
  if (options.length === 0) return null
  const chip = cn('rounded-full px-2.5 py-1 text-caption font-semibold tabular-nums', free ? 'bg-background/12' : 'bg-muted')
  return (
    <span className='mt-1 flex flex-wrap items-center gap-1.5'>
      {hasOptions(place.tariff) ? (
        <>
          {options.map((o) => (
            <span key={o.code} className={chip}>
              {t('optionRateFormat', { option: localized(o.name), rate: price.whole(o.hourlyRate) })}
            </span>
          ))}
          <span className={cn('text-caption font-medium', free ? 'opacity-70' : 'text-muted-foreground')}>{t('perHourShort')}</span>
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
export function PlaceCardSkeleton({ look = 'cards' }: { look?: PlacesStyle }) {
  if (look === 'list') {
    return (
      <div className='surface flex min-h-16 items-center gap-3 rounded-[1.25rem] p-3'>
        <Skeleton className='size-11 rounded-2xl' />
        <div className='flex flex-1 flex-col gap-1.5'>
          <Skeleton className='h-5 w-32' />
          <Skeleton className='h-3.5 w-24' />
        </div>
      </div>
    )
  }
  if (look === 'grid') {
    return (
      <div className='surface flex min-h-31 flex-col justify-between rounded-3xl p-4'>
        <Skeleton className='h-5 w-16 rounded-full' />
        <div className='flex flex-col gap-1.5'>
          <Skeleton className='h-5 w-24' />
          <Skeleton className='h-3.5 w-16' />
        </div>
      </div>
    )
  }
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
