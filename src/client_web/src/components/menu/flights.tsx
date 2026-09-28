import { motion } from 'motion/react'
import { DishPhoto } from './dish-photo'
import { flightPath, type Box } from '../tray/tray-model'

export type Flight = {
  id: number
  from: Box
  to: Box
  /** The photo, or null for a dish without one (its colour flies instead) */
  src: string | null
  toneClass: string
  /** The corner of what it took off from, px: the clip starts there */
  radius: number
  /** What happens as it lands: the dish goes into the order then, not before */
  land: () => void
}

/**
 * The photo of a dish just added, flying into the tray. It starts exactly
 * over the photo it came from, corners and all, and on the first part of
 * the way its clip closes into a centred circle, so it lands as what it
 * lands on: the tray's round thumbnail, at that thumbnail's size. It rises a
 * little on the way; it is carried and scaled by transform, and only its
 * clip is redrawn. The dish joins the order as it lands (its `land`), so
 * the tray changes when the photo gets there; each flight then removes
 * itself, so nothing is left running.
 */
export function FlightLayer({ flights, onLand }: { flights: Flight[]; onLand: (id: number) => void }) {
  return (
    <div aria-hidden className='pointer-events-none fixed inset-0 z-50 overflow-hidden'>
      {flights.map((f) => {
        const { dx, dy } = flightPath(f.from, f.to)
        // The circle it closes into: the largest the photo holds, round its centre
        const side = Math.min(f.from.width, f.from.height)
        const insetX = (f.from.width - side) / 2
        const insetY = (f.from.height - side) / 2
        const scale = side > 0 ? f.to.width / side : 1
        const clipFrom = `inset(0px 0px 0px 0px round ${f.radius}px)`
        const clipTo = `inset(${insetY}px ${insetX}px ${insetY}px ${insetX}px round ${side / 2}px)`
        // The arc: up first, then down into the tray
        const lift = Math.min(90, Math.abs(dy) * 0.25)
        return (
          <motion.div
            key={f.id}
            className='absolute'
            style={{ left: f.from.x, top: f.from.y, width: f.from.width, height: f.from.height, originX: 0.5, originY: 0.5 }}
            initial={{ x: 0, y: 0, scale: 1, clipPath: clipFrom }}
            animate={{
              x: [0, dx * 0.45, dx],
              y: [0, dy * 0.3 - lift, dy],
              scale: [1, Math.max(scale, 0.35), scale],
              clipPath: [clipFrom, clipTo, clipTo],
            }}
            transition={{ duration: 0.62, times: [0, 0.45, 1], ease: [0.3, 0, 0.2, 1] }}
            onAnimationComplete={() => onLand(f.id)}
          >
            {/* A photo that will not load flies as the plate, as the tray shows it, never as a broken image */}
            <DishPhoto src={f.src} />
          </motion.div>
        )
      })}
    </div>
  )
}
