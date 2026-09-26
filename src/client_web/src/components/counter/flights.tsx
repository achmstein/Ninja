import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { flightPath, type Box } from './tray-model'

export type Flight = {
  id: number
  from: Box
  to: Box
  /** The photo, or null for a dish without one (its colour flies instead) */
  src: string | null
  toneClass: string
}

/**
 * The photo of a dish just added, flying into the tray. It starts exactly
 * over the photo it came from and lands on the tray's first thumbnail,
 * rising a little on the way, moved only by transform. Each flight removes
 * itself when it lands, so nothing is left running.
 */
export function FlightLayer({ flights, onLand }: { flights: Flight[]; onLand: (id: number) => void }) {
  return (
    <div aria-hidden className='pointer-events-none fixed inset-0 z-50 overflow-hidden'>
      {flights.map((f) => {
        const { dx, dy, scale } = flightPath(f.from, f.to)
        // The arc: up first, then down into the tray
        const lift = Math.min(90, Math.abs(dy) * 0.25)
        return (
          <motion.div
            key={f.id}
            className={cn('absolute overflow-hidden rounded-3xl shadow-xl', !f.src && f.toneClass)}
            style={{ left: f.from.x, top: f.from.y, width: f.from.width, height: f.from.height, originX: 0.5, originY: 0.5 }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: [0, dx * 0.45, dx], y: [0, dy * 0.3 - lift, dy], scale: [1, Math.max(scale, 0.35), scale], opacity: [1, 1, 0.9] }}
            transition={{ duration: 0.62, times: [0, 0.45, 1], ease: [0.3, 0, 0.2, 1] }}
            onAnimationComplete={() => onLand(f.id)}
          >
            {f.src && <img src={f.src} alt='' className='size-full object-cover' />}
          </motion.div>
        )
      })}
    </div>
  )
}
