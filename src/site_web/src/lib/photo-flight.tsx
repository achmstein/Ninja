// From client_web/src/components/menu/photo-flight.tsx: a photo flying from one frame to
// another on one spring. The same maths; here the room is a device screen drawn at a scale,
// so what is measured on the page is divided back into the screen's own pixels.
import { motion, useTransform, type MotionValue } from 'motion/react'
import { springOpen } from '@/lib/motion'

export const FLIGHT_SPRING = { ...springOpen, restDelta: 0.0005, restSpeed: 0.01 }

type Box = { x: number; y: number; w: number; h: number }

export type Flight = {
  from: Box
  to: Box
  fromRadius: number
  toRadius: number
  nw: number
  nh: number
  roomW: number
  roomH: number
  src: string
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p

/** The flight from `from` to `to` as they are on screen now, inside `room`, whose screen is `roomW` of its own pixels wide */
export function planFlight(from: HTMLElement | null, to: HTMLElement | null, room: HTMLElement | null, roomW: number): Flight | null {
  if (!from?.isConnected || !to?.isConnected || !room) return null
  const origin = room.getBoundingClientRect()
  if (origin.width < 1) return null
  const k = origin.width / roomW
  const boxIn = (el: Element): Box => {
    const r = el.getBoundingClientRect()
    return { x: (r.left - origin.left) / k, y: (r.top - origin.top) / k, w: r.width / k, h: r.height / k }
  }
  const a = boxIn(from)
  const b = boxIn(to)
  if (a.w < 1 || a.h < 1 || b.w < 1 || b.h < 1) return null
  const fromImg = from instanceof HTMLImageElement ? from : from.querySelector('img')
  if (!fromImg) return null
  return {
    from: a,
    to: b,
    fromRadius: parseFloat(getComputedStyle(from).borderTopLeftRadius) || 0,
    toRadius: parseFloat(getComputedStyle(to).borderTopLeftRadius) || 0,
    nw: fromImg.naturalWidth || b.w,
    nh: fromImg.naturalHeight || b.h,
    roomW,
    roomH: origin.height / k,
    src: fromImg.currentSrc || fromImg.src,
  }
}

/** Where the photo is at `p` of the way: its frame as a clip on the room, and the whole photo's place and scale under it */
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
  }
}

/** A photo in flight over the room, following `progress`; a copy, fading over its last fifth onto the one it lands on */
export function FlyingPhoto({ flight, progress }: { flight: Flight; progress: MotionValue<number> }) {
  const clip = useTransform(progress, (p) => flightAt(flight, p).clip)
  const x = useTransform(progress, (p) => flightAt(flight, p).x)
  const y = useTransform(progress, (p) => flightAt(flight, p).y)
  const scale = useTransform(progress, (p) => flightAt(flight, p).scale)
  const opacity = useTransform(progress, [0.8, 1], [1, 0])
  return (
    <motion.div aria-hidden style={{ clipPath: clip, opacity }} className='pointer-events-none absolute inset-0 z-30'>
      <motion.img
        src={flight.src}
        alt=''
        draggable={false}
        style={{ x, y, scale, width: flight.nw, height: flight.nh, originX: 0, originY: 0 }}
        className='absolute top-0 left-0 max-w-none'
      />
    </motion.div>
  )
}
