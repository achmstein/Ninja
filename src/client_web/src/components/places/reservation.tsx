import { AnimatePresence, motion } from 'motion/react'
import { type ReservationViewModel } from '@/api/spaces'
import { springOpen } from '@/lib/motion'
import { placeCardId } from '@/lib/places'
import { useEntrance } from '@/components/motion/use-entrance'
import { ReservationFace } from './reservation-face'

/**
 * The customer's reservation, opened out of its place's card the way a dish
 * opens on the menu (components/ninja/tune.tsx): it shares the card's
 * layout id, so it grows from the card's own box to the space between the
 * bars on the menu's spring, solid the whole way (no crossfade: the card's
 * own content would show through it), and closes back into it the same
 * way. The card must stay on screen to be closed back into, so the tab
 * fades everything else out (Recede) rather than covering it. A hold that
 * is already there when the tab opens is simply open.
 */
export function Reservation({ hold }: { hold: ReservationViewModel | undefined }) {
  return <AnimatePresence initial={false}>{hold && <Opened key={String(hold.id)} hold={hold} />}</AnimatePresence>
}

function Opened({ hold }: { hold: ReservationViewModel }) {
  const clock = useEntrance()
  return (
    <motion.div
      layoutId={placeCardId(hold.placeId)}
      // Solid from its first frame: a crossfade would show the room card's own content through it
      layoutCrossfade={false}
      transition={springOpen}
      style={{ borderRadius: 32 }}
      role='dialog'
      aria-label={String(hold.placeName?.en ?? '')}
      // Between the top bar (64 px) and the dock, at the dock's side margins; the slab's tints for what is inside
      className='bg-foreground text-background fixed inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] bottom-[84px] z-20 mx-auto max-w-lg overflow-hidden shadow-[0_16px_36px_-18px_rgb(0_0_0/0.45)] md:top-24 md:bottom-6 [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))] [--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))]'
    >
      {/* Contained: what changes inside (the clock each second) never lays out or repaints the page around it */}
      <motion.div className='no-scrollbar size-full overflow-y-auto [contain:content]' exit={{ opacity: 0, transition: { duration: 0.12 } }}>
        <ReservationFace reservation={hold} clock={clock} />
      </motion.div>
    </motion.div>
  )
}
