import type { Transition } from 'motion/react'

/**
 * The motion language, with the same numbers as the till and the kitchen
 * display (pos_app / kds_app lib/core/motion/motion.dart).
 *
 * One element changes shape instead of cutting to another; springs land
 * with at most a hair of overshoot; every step is 150–350 ms and nothing
 * holds the hand that tapped. Only transform, opacity and size move.
 * Under prefers-reduced-motion, components fall back to plain fades
 * (useReducedMotion from motion/react).
 */
export const duration = {
  /** A colour, a tick, a press */
  fast: 0.15,
  /** Most changes of state */
  base: 0.25,
  /** Things that travel: an entrance, a collapse */
  slow: 0.35,
} as const

export const ease = {
  /** Arriving: quick off the mark, a long soft landing */
  enter: [0.16, 1, 0.3, 1],
  /** Leaving: gathers pace and goes */
  exit: [0.4, 0, 1, 1],
  /** From one place to another, both ends eased */
  move: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, [number, number, number, number]>

/** Damping ratio ≈ 0.93: settles in about 200 ms, a barely-there overshoot */
export const spring: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 38,
  mass: 1,
}

/** The same character, slower, for things that travel further */
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 1,
}

/** A plain fade, what everything becomes under reduced motion */
export const fade: Transition = { duration: duration.fast, ease: 'linear' }

/**
 * A content swap: the new content sharpens in from a small blur and a 92 %
 * scale while the old one goes the other way. Use with AnimatePresence
 * mode='popLayout' (or 'wait' where the two must not overlap).
 */
export function blurSwap(reduced: boolean | null) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: fade,
    }
  }
  return {
    initial: { opacity: 0, scale: 0.92, filter: 'blur(4px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 0.92, filter: 'blur(4px)' },
    transition: { duration: duration.base, ease: ease.enter },
  }
}
