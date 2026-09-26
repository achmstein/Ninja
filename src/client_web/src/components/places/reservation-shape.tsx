import { useEffect, useRef, useState, type RefObject } from 'react'
import { animate, motion, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { Check } from 'lucide-react'
import { type ReservationViewModel } from '@/api/spaces'
import { holdOrigin } from '@/lib/hold-origin'
import { NINJA_BAR_H } from '@/components/ninja/chrome'
import { ReservationFace } from './reservation-view'

/** The one spring the whole move runs on: every size, corner, colour and fade below is read off its progress */
const MORPH = { type: 'spring', stiffness: 170, damping: 26, mass: 1 } as const

/** Where the shape starts (at progress 0): a box on screen, its corner and its colour */
type Start = { rect: { x: number; y: number; width: number; height: number }; radius: number; color: string }

/** Where the reservation sits (at progress 1): between the top bar and the dock, the dock's side margins */
function frame() {
  const narrow = window.innerWidth < 768
  const width = Math.min(window.innerWidth, 512) - 32
  const x = (window.innerWidth - width) / 2
  const top = narrow ? NINJA_BAR_H + 8 : 96
  const bottom = narrow ? 84 : 24
  return { x, y: top, width, height: window.innerHeight - top - bottom }
}

type Box = { x: number; y: number; width: number; height: number }

const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** One edge of the shape's box, read off the progress between where it starts and the reservation's frame */
function useEdge(progress: MotionValue<number>, start: RefObject<Start | null>, target: RefObject<Box>, key: keyof Box) {
  return useTransform(progress, (p) => mix(start.current?.rect[key] ?? target.current[key], target.current[key], p))
}
/** A window of the progress mapped to 0..1, so a part can have its own enter and exit */
const within = (p: number, from: number, to: number) => Math.min(1, Math.max(0, (p - from) / (to - from)))

/**
 * The reservation as one shape. Booking, it is the book button's green tick
 * growing until it fills the screen, its corners opening and its colour
 * turning into the dock's dark, while the places behind it fall out of
 * focus (the camera, `camera` below); cancelling, it shrinks back onto its
 * own place's card, in that card's colour and corners, and hands over to
 * it seamlessly. Everything is a pure function of one progress value on
 * one spring, so the move can turn back from any point mid-way and its way
 * back is exactly its way there. The tick and the countdown each have
 * their own window of the progress, so the two never overlap, and the
 * countdown is laid out at its final size from the start: nothing inside
 * reflows while the shape changes size.
 */
export function ReservationShape({
  hold,
  progress,
  placeCard,
}: {
  hold: ReservationViewModel | undefined
  /** Shared with the page, which reads its camera off it */
  progress: MotionValue<number>
  /** The card of a place in the list, to shrink back onto */
  placeCard: (placeId: number | string | undefined) => HTMLElement | null
}) {
  const reduced = useReducedMotion()
  // The reservation drawn: the hold, and the last one while it shrinks away after a cancel
  const [shown, setShown] = useState(hold)
  if (hold && hold !== shown) setShown(hold)
  const start = useRef<Start | null>(null)
  // The frame it fills: as state for the layout inside, as a ref for the transforms; both follow the window
  const [size, setSize] = useState(frame)
  const target = useRef<Box>(size)
  useEffect(() => {
    const onResize = () => {
      target.current = frame()
      setSize(target.current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const holdId = hold?.id

  useEffect(() => {
    const card = (placeId: number | string | undefined): Start | null => {
      const el = placeCard(placeId)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { rect: { x: r.x, y: r.y, width: r.width, height: r.height }, radius: 28, color: 'var(--primary)' }
    }
    if (holdId != null) {
      // Grows out of the tick where it was; else (a hold that was already there, one made
      // elsewhere) out of its place's card, or it is simply there
      const tick = holdOrigin.take()
      start.current = tick
        ? // The tick's own green (MorphButton's emerald-600), so the hand-over is seamless
          { rect: { x: tick.x, y: tick.y, width: tick.width, height: tick.height }, radius: tick.height / 2, color: 'oklch(0.596 0.145 163.225)' }
        : card(shown?.placeId)
      if (!start.current || reduced || progress.get() === 1) {
        progress.jump(1)
        return
      }
      const run = animate(progress, 1, MORPH)
      return () => run.stop()
    }
    if (progress.get() === 0) return
    // Cancelled (or the hold lapsed): back onto its own card, then gone
    start.current = card(shown?.placeId) ?? start.current
    const run = animate(progress, 0, reduced ? { duration: 0 } : MORPH)
    run.then(() => setShown(undefined))
    return () => run.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdId])

  const x = useEdge(progress, start, target, 'x')
  const y = useEdge(progress, start, target, 'y')
  const width = useEdge(progress, start, target, 'width')
  const height = useEdge(progress, start, target, 'height')
  const radius = useTransform(progress, (p) => mix(start.current?.radius ?? 32, 32, p))
  // The colour: the start's blending into the dock's dark, in one colour space, off the same progress
  const background = useTransform(
    progress,
    (p) => `color-mix(in oklab, ${start.current?.color ?? 'var(--foreground)'} ${((1 - p) * 100).toFixed(1)}%, var(--foreground))`
  )
  const tick = useTransform(progress, (p) => 1 - within(p, 0, 0.18))
  const face = useTransform(progress, (p) => within(p, 0.5, 0.95))
  const faceBlur = useTransform(face, (v) => `blur(${((1 - v) * 8).toFixed(2)}px)`)
  const faceScale = useTransform(face, (v) => 0.96 + v * 0.04)
  const shownAtAll = useTransform(progress, (p) => (p > 0.001 ? 'block' : 'none'))

  if (!shown) return null

  return (
    <motion.div
      className='text-background fixed z-20 overflow-hidden shadow-[0_24px_60px_-16px_rgb(0_0_0/0.5)] [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))] [--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))]'
      style={{ left: x, top: y, width, height, borderRadius: radius, background, display: shownAtAll }}
    >
      <motion.span className='absolute inset-0 grid place-items-center text-white' style={{ opacity: tick }} aria-hidden>
        <Check className='size-6' strokeWidth={3} />
      </motion.span>
      {/* Laid out at the reservation's own size from the start, so it never reflows; the shape clips it */}
      <motion.div
        className='absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto'
        style={{ width: size.width, height: size.height, opacity: face, filter: faceBlur, scale: faceScale }}
      >
        <ReservationFace reservation={shown} />
      </motion.div>
    </motion.div>
  )
}

/** The places behind the reservation: out of focus as it grows over them, back as it goes */
export function useCamera(progress: MotionValue<number>) {
  const opacity = useTransform(progress, (p) => 1 - within(p, 0.05, 0.55))
  const filter = useTransform(progress, (p) => `blur(${(within(p, 0, 0.6) * 6).toFixed(2)}px)`)
  return { opacity, filter }
}

