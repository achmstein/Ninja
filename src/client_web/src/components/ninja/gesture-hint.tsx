import { motion, useReducedMotion, type Transition } from 'motion/react'
import { GESTURE_DELAY_S, GESTURE_GAP_S, GESTURE_S, type GestureKind } from './gesture-timing'

/**
 * A first-visit gesture shown the way a hand would do it: fingertips on the
 * glass pressing, dragging, pinching or holding, in step with the demo the
 * menu itself plays (the deck nudged up, breathed out, a card's ring filling).
 * Each runs twice. Under reduced motion there is no demo to act out, so the
 * words beside it carry the cue alone. Put it inside an AnimatePresence, over
 * the area the gesture is about.
 */
export function GestureHint({ kind, className }: { kind: GestureKind; className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return null
  const pass = (times: number[]): Transition => ({
    duration: GESTURE_S[kind],
    times,
    ease: 'easeInOut',
    delay: GESTURE_DELAY_S,
    repeat: 1,
    repeatDelay: GESTURE_GAP_S,
  })
  return (
    <motion.div
      aria-hidden
      className={className ?? 'pointer-events-none absolute inset-0 z-20 grid place-items-center'}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      {kind === 'swipe' && (
        // Up with the deck's long nudge, then a shorter flick with its second
        <Tip
          animate={{
            y: [70, 70, -70, -70, 40, 40, -20, -20],
            opacity: [0, 1, 1, 0, 0, 1, 1, 0],
            scale: [1.25, 0.9, 0.9, 1.2, 1.25, 0.9, 0.9, 1.2],
          }}
          transition={pass([0, 0.06, 0.3, 0.38, 0.5, 0.56, 0.75, 0.82])}
        />
      )}
      {kind === 'pinch' &&
        // Two fingers closing as the deck breathes out to the whole menu, lifting while it breathes back in
        [-1, 1].map((side) => (
          <Tip
            key={side}
            animate={{
              x: [side * 95, side * 95, side * 30, side * 30],
              y: [side * -60, side * -60, side * -18, side * -18],
              opacity: [0, 1, 1, 0],
              scale: [1.25, 0.9, 0.9, 1.2],
            }}
            transition={pass([0, 0.06, 0.32, 0.42])}
          />
        ))}
      {kind === 'hold' && (
        // Down on the card and kept there while its ring fills, then up
        <Tip
          animate={{ opacity: [0, 1, 1, 0], scale: [1.3, 0.85, 0.85, 1.25] }}
          transition={pass([0, 0.1, 0.82, 1])}
          ring
        />
      )}
      {kind === 'drag' && (
        // On the tray and up, the way the order is pulled out of it
        <Tip animate={{ y: [0, 0, -110, -110], opacity: [0, 1, 1, 0], scale: [1.25, 0.9, 0.9, 1.2] }} transition={pass([0, 0.1, 0.65, 0.78])} />
      )}
    </motion.div>
  )
}

/** A fingertip on the glass: a soft disc with a halo, readable on a photo or on the page */
function Tip({ animate, transition, ring }: { animate: Record<string, number[]>; transition: Transition; ring?: boolean }) {
  return (
    <motion.span
      className='absolute size-12 rounded-full bg-white/75 shadow-[0_0_0_8px_rgb(255_255_255/0.25),0_6px_20px_rgb(0_0_0/0.35)] backdrop-blur-[2px]'
      initial={{ opacity: 0 }}
      animate={animate}
      transition={transition}
    >
      {ring && (
        // The hold's time, drawn round the fingertip
        <svg viewBox='0 0 60 60' className='absolute -inset-2 size-16 -rotate-90'>
          <motion.circle
            cx={30}
            cy={30}
            r={27}
            fill='none'
            stroke='white'
            strokeWidth={3}
            strokeLinecap='round'
            initial={{ pathLength: 0 }}
            animate={{ pathLength: [0, 0, 1, 1] }}
            transition={transition}
          />
        </svg>
      )}
    </motion.span>
  )
}
