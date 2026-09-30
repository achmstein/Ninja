import { motion, useTransform, type MotionValue } from 'motion/react'
import { springOpen } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { TONE_CLASS } from './deck/deck-model'
import { cornerOf } from './photo-corner'

/**
 * The one spring a photo's flight and everything round it run on, settled
 * tight: at the default rest (1 % of the way) the photo's last few pixels
 * jumped into place
 */
export const FLIGHT_SPRING = { ...springOpen, restDelta: 0.0005, restSpeed: 0.01 }

type Box = { x: number; y: number; w: number; h: number }

/**
 * A dish's photo on its way from one place on screen to another (a dish to
 * its sheet's banner, a card to its tile), in the coordinates of the room it
 * flies in: the two frames and their corners, the photo's natural size
 * (each end shows it "cover", cropped its own way) and the room's size,
 * which the clip is measured from. `src` is the photo, or null for the plate
 * on the business's colour; `gray` for a dish sold out.
 */
export type Flight = {
  from: Box
  to: Box
  fromRadius: number
  toRadius: number
  nw: number
  nh: number
  roomW: number
  roomH: number
  src: string | null
  gray: boolean
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p

function boxIn(el: Element, origin: DOMRect): Box {
  const r = el.getBoundingClientRect()
  return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height }
}

/** The flight from `from` to `to` as they are on screen now, inside `room`; none when either has no size */
export function planFlight(from: HTMLElement | null, to: HTMLElement | null, room: HTMLElement | null): Flight | null {
  if (!from?.isConnected || !to?.isConnected || !room) return null
  const origin = room.getBoundingClientRect()
  const a = boxIn(from, origin)
  const b = boxIn(to, origin)
  if (a.w < 1 || a.h < 1 || b.w < 1 || b.h < 1) return null
  const fromImg = from.querySelector('img')
  // The photo's own shape, from whichever copy has loaded; unknown, the far end's (exact there)
  const img = [fromImg, to.querySelector('img')].find((i) => i && i.naturalWidth > 0)
  return {
    from: a,
    to: b,
    fromRadius: cornerOf(from),
    toRadius: cornerOf(to),
    nw: img?.naturalWidth || b.w,
    nh: img?.naturalHeight || b.h,
    roomW: origin.width,
    roomH: origin.height,
    src: (fromImg ?? to.querySelector('img'))?.currentSrc || null,
    gray: !!from.closest('.grayscale'),
  }
}

/**
 * Where the photo is at `p` of the way (0 `from`, 1 `to`): its frame, as a clip on the room, and
 * the whole photo's place and scale under it. The frame and its corner are carried straight
 * across; the photo is scaled from how one end crops it to how the other does, which always still
 * covers the frame between, so it never stretches and never shows an edge
 */
export function flightAt(f: Flight, p: number) {
  const q = Math.min(1, Math.max(0, p))
  const x = lerp(f.from.x, f.to.x, q)
  const y = lerp(f.from.y, f.to.y, q)
  const w = lerp(f.from.w, f.to.w, q)
  const h = lerp(f.from.h, f.to.h, q)
  const scale = lerp(Math.max(f.from.w / f.nw, f.from.h / f.nh), Math.max(f.to.w / f.nw, f.to.h / f.nh), q)
  const inset = [y, f.roomW - x - w, f.roomH - y - h, x].map((v) => `${Math.max(0, v)}px`).join(' ')
  return {
    clip: `inset(${inset} round ${lerp(f.fromRadius, f.toRadius, q)}px)`,
    x: x + w / 2 - (f.nw * scale) / 2,
    y: y + h / 2 - (f.nh * scale) / 2,
    scale,
    cx: x + w / 2,
    cy: y + h / 2,
  }
}

/**
 * A photo in flight, over the room it flies in, following `progress`. It is
 * a copy: what it leaves and what it lands on stay where they are, so over
 * its last fifth it fades, handing over to the one it has landed on, whose
 * words (a card's name, a tile's) then come in under it rather than at once.
 */
export function FlyingPhoto({ flight, progress }: { flight: Flight; progress: MotionValue<number> }) {
  const clip = useTransform(progress, (p) => flightAt(flight, p).clip)
  const x = useTransform(progress, (p) => flightAt(flight, p).x)
  const y = useTransform(progress, (p) => flightAt(flight, p).y)
  const scale = useTransform(progress, (p) => flightAt(flight, p).scale)
  const opacity = useTransform(progress, [0.8, 1], [1, 0])
  return (
    <motion.div
      aria-hidden
      style={{ clipPath: clip, opacity }}
      className={cn('pointer-events-none absolute inset-0 z-10', !flight.src && TONE_CLASS.primary)}
    >
      {flight.src && (
        <motion.img
          src={flight.src}
          alt=''
          draggable={false}
          style={{ x, y, scale, width: flight.nw, height: flight.nh, originX: 0, originY: 0 }}
          className={cn('absolute top-0 left-0 max-w-none', flight.gray && 'grayscale')}
        />
      )}
    </motion.div>
  )
}
