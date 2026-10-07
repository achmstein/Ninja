import { useEffect, useId, useRef } from 'react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

const TAU = Math.PI * 2

/** A damped spring's step from 0 to 1: under-damped, so it overshoots and settles */
function spring(t: number, freq: number, zeta: number) {
  if (t <= 0) return 0
  const w = TAU * freq
  const wd = w * Math.sqrt(1 - zeta * zeta)
  return (
    1 -
    Math.exp(-zeta * w * t) *
      (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t))
  )
}

/** A decaying swing out and back: the squash and stretch after the pop */
function wobble(t: number, freq: number, zeta: number) {
  if (t <= 0) return 0
  const w = TAU * freq
  const wd = w * Math.sqrt(1 - zeta * zeta)
  return Math.exp(-zeta * w * t) * Math.sin(wd * t)
}

const clamp = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const n = (v: number) => (Math.round(v * 1000) / 1000).toString()

/** The gather before the pop, s */
const GATHER = 0.14
/** At rest the flutter fades out by then, s; working, the pop comes round again */
const REST_END = 2.6
const WORK_LOOP = 1.6

/**
 * Ninja, the assistant: a hood with only the eye slit open and the
 * headband's tails off its side, in the colour of whatever it sits in. It
 * stands wherever the AI does something ("Propose with Ninja", "Fill in with
 * Ninja", a field Ninja filled).
 *
 * It arrives with a pop: the hood gathers to 55% and springs back past its
 * size, squashing and stretching as it settles, the tails flicking out, then
 * fluttering a moment before it rests. `replay` (a counter, bumped on hover)
 * pops it again. `working`: the pop comes round again and again and the
 * tails keep fluttering while Ninja is at it, in place of a spinner. Still
 * under reduced motion.
 */
export function NinjaMark({
  working = false,
  replay = 0,
  className,
}: {
  working?: boolean
  replay?: number
  className?: string
}) {
  const slit = useId()
  const reduced = useReducedMotion()
  const place = useRef<SVGGElement>(null)
  const head = useRef<SVGGElement>(null)
  const tail1 = useRef<SVGPathElement>(null)
  const tail2 = useRef<SVGPathElement>(null)

  useEffect(() => {
    if (reduced) return
    let frame = 0
    const start = performance.now()

    const draw = (t: number, idle: number) => {
      let scale: number
      let kick: number
      let swing: number
      if (t < GATHER) {
        const p = t / GATHER
        scale = lerp(1, 0.55, p * p)
        kick = lerp(0, 0.6, p)
        swing = 0
      } else {
        scale = 0.55 + 0.45 * spring(t - GATHER, 2.6, 0.42)
        kick = 0.6 * (1 - spring(t - GATHER, 2.4, 0.35))
        swing = wobble(t - GATHER, 3.4, 0.32)
      }
      const bob = -0.35 * Math.sin((t - 0.7) * TAU * 0.8) * idle
      place.current?.setAttribute(
        'transform',
        `translate(11 12.5) scale(${n(scale)}) translate(-11 -12.5)`
      )
      head.current?.setAttribute(
        'transform',
        `translate(0 ${n(bob)}) translate(11 12.5) scale(${n(1 - 0.16 * swing)} ${n(1 + 0.16 * swing)}) translate(-11 -12.5)`
      )

      // The tails: straight in the mark, streaming and fluttering in between
      const w = t * TAU * 5.5
      const f1 = Math.sin(t * TAU * 2.4) * idle
      const f2 = Math.sin(t * TAU * 2.4 + 1.4) * idle
      const e1x = lerp(22.4, 29.6, kick)
      const e1y = lerp(8.2, 9.6 + 1.2 * Math.sin(w), kick) + 0.22 * f1
      const e2x = lerp(22.6, 28.6, kick)
      const e2y = lerp(13.8, 13.0 + 1.2 * Math.sin(w + 2.1), kick) + 0.22 * f2
      const c1y = (11 + e1y) / 2 + 1.6 * Math.sin(w + 1.2) * kick + 0.55 * f1
      const c2y = (11.8 + e2y) / 2 + 1.6 * Math.sin(w + 3.3) * kick + 0.55 * f2
      tail1.current?.setAttribute(
        'd',
        `M18.6 11 Q${n((18.6 + e1x) / 2)} ${n(c1y)} ${n(e1x)} ${n(e1y)}`
      )
      tail2.current?.setAttribute(
        'd',
        `M18.6 11.8 Q${n((18.6 + e2x) / 2)} ${n(c2y)} ${n(e2x)} ${n(e2y)}`
      )
    }

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000
      if (working) {
        const t = elapsed % WORK_LOOP
        draw(t, clamp((elapsed - 0.4) / 0.4))
      } else {
        // The flutter comes in after the pop and fades out again before it rests
        const idle =
          clamp((elapsed - 0.7) / 0.5) * clamp((REST_END - elapsed) / 0.6)
        draw(Math.min(elapsed, REST_END), idle)
        if (elapsed >= REST_END) {
          draw(REST_END, 0)
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [working, replay, reduced])

  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden
      className={cn('ninja-mark overflow-visible', className)}
    >
      <mask id={slit}>
        <rect width='24' height='24' fill='white' />
        <rect x='5' y='10.2' width='12' height='4' rx='2' fill='black' />
      </mask>
      <g ref={place}>
        <g ref={head}>
          <circle
            cx='11'
            cy='12.5'
            r='8.5'
            fill='currentColor'
            mask={`url(#${slit})`}
          />
          <ellipse cx='8.6' cy='12.2' rx='1.1' ry='0.85' fill='currentColor' />
          <ellipse cx='13.4' cy='12.2' rx='1.1' ry='0.85' fill='currentColor' />
        </g>
        <g
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
        >
          <path ref={tail1} d='M18.6 11 L22.4 8.2' />
          <path ref={tail2} d='M18.6 11.8 L22.6 13.8' />
        </g>
      </g>
    </svg>
  )
}
