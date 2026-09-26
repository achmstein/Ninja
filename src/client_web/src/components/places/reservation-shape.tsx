import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from 'motion/react'
import { Check } from 'lucide-react'
import { type ReservationViewModel } from '@/api/spaces'
import { holdOrigin } from '@/lib/hold-origin'
import { NINJA_BAR_H } from '@/components/ninja/chrome'
import { ReservationFace } from './reservation-view'

/** The one spring the whole move runs on: every size, corner, colour and fade below is read off its progress */
const MORPH = { type: 'spring', stiffness: 260, damping: 30, mass: 1 } as const

/** The reservation's corner once it has opened */
const RADIUS = 32

export type Box = { x: number; y: number; width: number; height: number }

/** Where the shape starts (at progress 0): a box on screen, its corner and its colour */
type Start = { rect: Box; radius: number; color: string }

/** Where the reservation sits (at progress 1): between the top bar and the dock, the dock's side margins */
function frame(): Box {
  const narrow = window.innerWidth < 768
  const width = Math.min(window.innerWidth, 512) - 32
  const x = (window.innerWidth - width) / 2
  const top = narrow ? NINJA_BAR_H + 8 : 96
  const bottom = narrow ? 84 : 24
  return { x, y: top, width, height: window.innerHeight - top - bottom }
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t
/** A window of the progress mapped to 0..1, so a part can have its own enter and exit */
const within = (p: number, from: number, to: number) => Math.min(1, Math.max(0, (p - from) / (to - from)))
/** The same, eased at both ends, so a stage starts and lands softly inside the spring */
const stage = (p: number, from: number, to: number) => {
  const t = within(p, from, to)
  return t * t * (3 - 2 * t)
}

/**
 * The two stages of the growth, the way the prompt's shape goes check →
 * island → player: across first (the tick stretches into a wide pill on its
 * own line), then down (the pill opens into the card). The windows overlap,
 * so it is one movement whose leading edges run ahead of the trailing ones.
 */
const ACROSS = [0, 0.5] as const
const DOWN = [0.22, 1] as const

function useEdge(progress: MotionValue<number>, start: RefObject<Start | null>, target: RefObject<Box>, key: keyof Box) {
  const [from, to] = key === 'x' || key === 'width' ? ACROSS : DOWN
  return useTransform(progress, (p) => mix(start.current?.rect[key] ?? target.current[key], target.current[key], stage(p, from, to)))
}

/**
 * The reservation as one shape. Booking, it is the book button's green tick:
 * it stretches across into a pill, opens down until it fills the space
 * between the bars, its corners going from a circle to a pill to the card's,
 * its colour turning into the dock's dark, while the camera moves in on it
 * and the places behind grow past and fade (useCamera). Cancelling, it runs
 * back the same way onto its own place's card, in that card's colour and
 * corners, and hands over to it seamlessly.
 *
 * Everything is a pure function of one progress value on one spring, so the
 * move can turn back from any point mid-way and its way back is its way
 * there. The tick and the content each have their own window of the
 * progress, so they never overlap, and the content is laid out at its final
 * size from the start: nothing inside reflows while the shape grows.
 */
export function ReservationShape({
  hold,
  progress,
  placeCard,
}: {
  hold: ReservationViewModel | undefined
  /** Shared with the page, which reads its camera off it */
  progress: MotionValue<number>
  /** Where the card of a place sits in the list at rest (the camera undone), to shrink back onto */
  placeCard: (placeId: number | string | undefined) => Box | null
}) {
  const reduced = useReducedMotion()
  // The reservation drawn: the hold, and the last one while it runs back after a cancel
  const [shown, setShown] = useState(hold)
  if (hold && hold !== shown) setShown(hold)
  const start = useRef<Start | null>(null)
  // Going back onto the card (a cancel): the booking's tick is not part of that way
  const returning = useRef(false)
  // Not drawn until it knows where it starts, so it never flashes at full size first
  const display = useMotionValue<'none' | 'block'>('none')
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

  // Laid out before paint: the shape appears exactly over what it grows out of
  useLayoutEffect(() => {
    const card = (placeId: number | string | undefined): Start | null => {
      const rect = placeCard(placeId)
      return rect ? { rect, radius: 28, color: 'var(--primary)' } : null
    }
    if (holdId != null) {
      returning.current = false
      // Grows out of the tick; else (a hold that was already there, or one made elsewhere)
      // out of its place's card, or it is simply there
      const tick = holdOrigin.take()
      start.current = tick
        ? // The tick's own green (MorphButton's emerald-600), so the hand-over is seamless
          { rect: tick.rect, radius: tick.rect.height / 2, color: 'oklch(0.596 0.145 163.225)' }
        : card(shown?.placeId)
      display.set('block')
      if (!start.current || reduced || progress.get() === 1) {
        progress.jump(1)
        return
      }
      // A nudge off zero, so every part is worked out afresh from this start
      progress.jump(0.0001)
      // It waits out the tick's own beat, then goes
      const run = animate(progress, 1, { ...MORPH, delay: tick?.delay ?? 0 })
      // Landed: a touch under the thumb, as a dish going into the tray gives
      run.then(() => navigator.vibrate?.(10))
      return () => run.stop()
    }
    if (progress.get() === 0) return
    // Cancelled (or the hold lapsed): back onto its own card, then gone
    returning.current = true
    start.current = card(shown?.placeId) ?? start.current
    const run = animate(progress, 0, reduced ? { duration: 0 } : MORPH)
    run.then(() => {
      display.set('none')
      setShown(undefined)
    })
    return () => run.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdId])

  const x = useEdge(progress, start, target, 'x')
  const y = useEdge(progress, start, target, 'y')
  const width = useEdge(progress, start, target, 'width')
  const height = useEdge(progress, start, target, 'height')
  // Circle, then pill (half its height while it is short), then the card's corner once it opens
  const radius = useTransform([progress, height], ([p, h]: number[]) => Math.min(h / 2, mix(start.current?.radius ?? RADIUS, RADIUS, p)))
  // The colour: the start's blending into the dock's dark, in one colour space, over the first stage
  const background = useTransform(progress, (p) => {
    const dark = stage(p, 0.05, 0.6) * 100
    return `color-mix(in oklab, ${start.current?.color ?? 'var(--foreground)'} ${(100 - dark).toFixed(1)}%, var(--foreground))`
  })
  const tick = useTransform(progress, (p) => (returning.current ? 0 : 1 - within(p, 0.02, 0.2)))
  // Only the small tick blurs as it goes: a blur over the whole face, redrawn each frame, stutters on a phone
  const tickBlur = useTransform(progress, (p) => `blur(${(within(p, 0.02, 0.2) * 6).toFixed(2)}px)`)
  // The content's own clock: from when the card has opened far enough to hold it
  const face = useTransform(progress, (p) => within(p, 0.42, 1))

  if (!shown) return null

  return (
    <motion.div
      // Contained, so its size changing each frame never lays out or repaints the page around it
      className='text-background fixed z-20 overflow-hidden shadow-[0_16px_36px_-18px_rgb(0_0_0/0.45)] [contain:strict] [--border:color-mix(in_oklab,var(--background)_16%,var(--foreground))] [--muted-foreground:color-mix(in_oklab,var(--background)_60%,var(--foreground))] [--muted:color-mix(in_oklab,var(--background)_10%,var(--foreground))]'
      style={{ left: x, top: y, width, height, borderRadius: radius, background, display }}
    >
      <motion.span className='absolute inset-0 grid place-items-center text-white' style={{ opacity: tick, filter: tickBlur }} aria-hidden>
        <Check className='size-6' strokeWidth={3} />
      </motion.span>
      {/* Laid out at the reservation's own size from the start, so it never reflows; the shape clips it */}
      <div
        className='absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto'
        style={{ width: size.width, height: size.height }}
      >
        <ReservationFace reservation={shown} enter={face} />
      </div>
    </motion.div>
  )
}

/**
 * The camera: as the reservation opens it moves in on it, the places behind
 * growing a little past the eye and fading, and moves back out as it goes.
 * Transform and opacity only, which the compositor moves without redrawing
 * the list.
 */
export function useCamera(progress: MotionValue<number>) {
  const opacity = useTransform(progress, (p) => 1 - within(p, 0.08, 0.55))
  const scale = useTransform(progress, (p) => 1 + stage(p, 0, 0.7) * 0.06)
  return { opacity, scale, originY: 0 }
}
