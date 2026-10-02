import { useEffect, useMemo } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { ease } from '@/lib/motion'

/** Dots thrown out of the tick: enough to read as a burst, few enough to stay calm */
const DOTS = 14

/** A number in [0, 1) that looks random but is fixed by the dot and the property it is for */
const jitter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * The moment a payment lands, around its tick: two rings swell out and fade,
 * and a burst of small dots, in the business's colour and the tick's green,
 * flies out on springs and settles away; a phone that can gives one short
 * buzz. Played once as the tick is drawn; nothing under reduced motion.
 * Sits behind the tick (absolutely placed, centred on it).
 */
export function SuccessBurst() {
  const reduced = useReducedMotion()

  // Spread evenly round the circle with a little jitter, so it reads as thrown rather than drawn; the jitter
  // comes from each dot's place, not chance, so the burst draws the same every time
  const dots = useMemo(
    () =>
      Array.from({ length: DOTS }, (_, i) => {
        const angle = (i / DOTS) * Math.PI * 2 + (jitter(i, 1) - 0.5) * 0.35
        const reach = 70 + jitter(i, 2) * 46
        return {
          x: Math.cos(angle) * reach,
          y: Math.sin(angle) * reach,
          size: 5 + Math.round(jitter(i, 3) * 5),
          brand: i % 3 !== 0,
          delay: 0.18 + jitter(i, 4) * 0.08,
        }
      }),
    []
  )

  useEffect(() => {
    if (reduced) return
    // One short buzz as the tick lands, where the phone can
    const timer = setTimeout(() => navigator.vibrate?.(30), 200)
    return () => clearTimeout(timer)
  }, [reduced])

  if (reduced) return null

  return (
    <div aria-hidden className='pointer-events-none absolute inset-0 grid place-items-center'>
      {[0, 0.16].map((delay) => (
        <motion.span
          key={delay}
          className='absolute size-20 rounded-full border-2 border-emerald-500'
          initial={{ scale: 1, opacity: 0.55 }}
          animate={{ scale: 2.3, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.15 + delay, ease: ease.enter }}
        />
      ))}
      {dots.map((dot, i) => (
        <motion.span
          key={i}
          className={dot.brand ? 'bg-primary absolute rounded-full' : 'absolute rounded-full bg-emerald-500'}
          style={{ width: dot.size, height: dot.size }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0 }}
          animate={{ x: dot.x, y: dot.y, scale: [0.4, 1, 0.6], opacity: [0, 1, 0] }}
          transition={{
            x: { type: 'spring', stiffness: 140, damping: 14, delay: dot.delay },
            y: { type: 'spring', stiffness: 140, damping: 14, delay: dot.delay },
            scale: { duration: 1.1, delay: dot.delay, times: [0, 0.25, 1] },
            opacity: { duration: 1.1, delay: dot.delay, times: [0, 0.15, 1] },
          }}
        />
      ))}
    </div>
  )
}
