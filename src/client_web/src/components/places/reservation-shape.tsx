import { useEffect } from 'react'
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import { type ReservationViewModel } from '@/api/spaces'
import { ease } from '@/lib/motion'
import { ReservationFace } from './reservation-view'

/** The menu's own open (components/ninja/tune.tsx): the same spring, so a place opens the way a dish does */
export const OPEN_SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const

/** The id a place's card and its reservation share, so one opens out of the other */
export const placeCardId = (placeId: number | string | null | undefined) => `place-${placeId}`
export const placeNameId = (placeId: number | string | null | undefined) => `place-name-${placeId}`

/**
 * The reservation, opened out of its place's card the way a dish opens on
 * the menu: it shares the card's layout id, so it grows from the card's own
 * box to the space between the bars, and the place's name travels with it
 * the way a dish's photo stays on screen. What it holds slides in under the
 * name one part after another. Cancelled, it closes back into the card. A
 * hold already there when the tab opens is simply open.
 */
export function ReservationShape({ hold }: { hold: ReservationViewModel | undefined }) {
  return <AnimatePresence initial={false}>{hold && <Opened key={String(hold.id)} hold={hold} />}</AnimatePresence>
}

function Opened({ hold }: { hold: ReservationViewModel }) {
  // The parts come in after the card has started to open, one on each beat
  const enter = useMotionValue(0)
  useEffect(() => {
    const run = animate(enter, 1, { duration: 0.55, ease: ease.enter, delay: 0.08 })
    return () => run.stop()
  }, [enter])

  return (
    <>
      {/* The page behind goes, as the menu goes behind an open dish: only the reservation is left */}
      <motion.div
        aria-hidden
        className='bg-background fixed inset-0 z-20'
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.22, ease: ease.enter } }}
        exit={{ opacity: 0, transition: { duration: 0.2, ease: ease.exit, delay: 0.08 } }}
      />
      <motion.div
        layoutId={placeCardId(hold.placeId)}
        // Solid the whole way: a crossfade with the room's card would leave it half
        // see-through over the page going white behind it, a grey flash
        layoutCrossfade={false}
        transition={OPEN_SPRING}
        style={{ borderRadius: 32 }}
        role='dialog'
        aria-label={String(hold.placeName?.en ?? '')}
        // Between the top bar (64 px) and the dock, at the dock's side margins
        className='bg-foreground text-background fixed inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] bottom-[84px] z-20 mx-auto max-w-lg overflow-hidden shadow-[0_16px_36px_-18px_rgb(0_0_0/0.45)] md:top-24 md:bottom-6 [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))] [--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))]'
      >
        <motion.div className='no-scrollbar size-full overflow-y-auto' exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          <ReservationFace reservation={hold} enter={enter} />
        </motion.div>
      </motion.div>
    </>
  )
}
