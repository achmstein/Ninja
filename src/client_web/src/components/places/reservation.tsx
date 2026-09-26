import { type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReservationViewModel } from '@/api/spaces'
import { ease, springOpen } from '@/lib/motion'
import { placeCardId } from '@/lib/places'
import { useEntrance } from '@/components/motion/use-entrance'
import { useLiveBills } from '@/lib/live-bills'
import { DOCK_H } from '@/components/ninja/chrome'
import { useDockRowShown } from '@/components/ninja/use-dock-row'
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
  // The dock grows by a row when it carries the bill, the order or the table: the card ends above that too
  const row = useDockRowShown(useLiveBills()) ? DOCK_H : 0
  return (
    <motion.div
      layoutId={placeCardId(hold.placeId)}
      // Solid from its first frame: a crossfade would show the room card's own content through it
      layoutCrossfade={false}
      transition={springOpen}
      // Closing, it hands over at once: it fades as the room's card, already under it with its
      // own face, runs back to its place, rather than shrinking empty over the card
      exit={{ opacity: 0, transition: { duration: 0.16, ease: ease.exit } }}
      style={{ borderRadius: 32, '--dock-row': `${row}px` } as CSSProperties}
      role='dialog'
      aria-label={String(hold.placeName?.en ?? '')}
      // Between the top bar (64 px) and the dock, at the dock's side margins; the slab's tints for what is inside
      className='slab fixed inset-x-4 top-[calc(env(safe-area-inset-top)+72px)] bottom-[calc(84px+var(--dock-row))] z-20 mx-auto max-w-lg overflow-hidden shadow-[0_16px_36px_-18px_rgb(0_0_0/0.45)] [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))] [--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))]'
    >
      {/* Contained: what changes inside (the clock each second) never lays out or repaints the page around it */}
      <div className='no-scrollbar size-full overflow-y-auto [contain:content]'>
        <ReservationFace reservation={hold} clock={clock} />
      </div>
    </motion.div>
  )
}
