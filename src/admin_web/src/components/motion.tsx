import { useEffect, useRef, type ReactNode } from 'react'
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  type Transition,
} from 'motion/react'
import { cn } from '@/lib/utils'

/**
 * The admin's motion, one vocabulary for every page: what arrives rises a
 * little and fades in, a group of cards follows one another, an active
 * marker slides to what was chosen, a number counts to its value. Springs,
 * short, never in the way; all of it still under reduced motion (the
 * MotionConfig at the root, and the checks here).
 */

/** A soft spring for things arriving and markers sliding */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
}

/** What a page or a section does as it arrives */
export const RISE = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
} as const

/** A group whose children arrive one after another (cards, tiles, rows) */
export function Stagger({
  children,
  className,
  gap = 0.045,
}: {
  children: ReactNode
  className?: string
  /** Seconds between one child and the next */
  gap?: number
}) {
  return (
    <motion.div
      className={className}
      initial='hidden'
      animate='shown'
      variants={{ hidden: {}, shown: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

/** One child of a Stagger */
export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10, scale: 0.985 },
        shown: { opacity: 1, y: 0, scale: 1, transition: SPRING },
      }}
    >
      {children}
    </motion.div>
  )
}

/**
 * A number counting to its value the first time it is seen, and from the
 * old value to the new one when it changes (a live sale): the eye catches
 * that it moved. Formatted as the page formats it; straight to the value
 * under reduced motion.
 */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  className,
}: {
  value: number
  format?: (n: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(0)
  const seen = useInView(ref, { once: true })
  const reduce = useReducedMotion()

  useEffect(() => {
    const node = ref.current
    if (!node || !seen) return
    if (reduce || !Number.isFinite(value)) {
      node.textContent = format(value)
      from.current = value
      return
    }
    const controls = animate(from.current, value, {
      duration: from.current === 0 ? 0.9 : 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (n) => {
        node.textContent = format(n)
      },
    })
    from.current = value
    return () => controls.stop()
    // format is a fresh function each render; the value is what moves it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, seen, reduce])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {format(reduce ? value : from.current)}
    </span>
  )
}

/**
 * The marker under whichever of a set is active (a sidebar link, a tab, a
 * tab bar's button): one shape that slides from the old to the new rather
 * than one switching off and another on. Put it inside the active item,
 * positioned; items of one set share `group`.
 */
export function ActiveMarker({
  group,
  className,
}: {
  group: string
  className?: string
}) {
  return (
    <motion.span
      aria-hidden
      layoutId={`active-${group}`}
      transition={SPRING}
      className={cn('absolute inset-0 -z-10', className)}
    />
  )
}
