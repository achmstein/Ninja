import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'motion/react'
import { formatClock } from '@/lib/clock'
import { ease, progressWindow } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Odometer } from '@/components/ninja/odometer'

const SIZE = 216
const STROKE = 10
const R = (SIZE - STROKE) / 2

/**
 * The time a hold has left, its digits rolling like the tray's total, inside
 * a ring that runs down with it. As the reservation arrives (`clock`) the
 * ring draws itself round to the share left. After that it steps once a
 * second in a short ease, so it runs down without redrawing on every frame.
 */
export function CountdownRing({
  left,
  total,
  hurry,
  clock,
}: {
  /** Seconds left */
  left: number
  /** Seconds the hold was given */
  total: number
  /** Nearly out: the ring and the time turn to a warning */
  hurry: boolean
  clock?: MotionValue<number>
}) {
  const share = useMotionValue(Math.max(0.001, left / total))
  useEffect(() => {
    const run = animate(share, Math.max(0.001, left / total), { duration: 0.4, ease: ease.move })
    return () => run.stop()
  }, [share, left, total])
  const still = useMotionValue(1)
  const drawn = useTransform(clock ?? still, (v) => progressWindow(v, 0.15, 0.8))
  const pathLength = useTransform([drawn, share], ([d, s]: number[]) => d * s)

  return (
    <div className='relative grid place-items-center' style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className='absolute inset-0 -rotate-90' aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill='none' stroke='currentColor' strokeOpacity={0.12} strokeWidth={STROKE} />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill='none'
          stroke='currentColor'
          strokeWidth={STROKE}
          strokeLinecap='round'
          className={cn('transition-colors duration-300', hurry ? 'text-destructive' : 'text-amber-400')}
          style={{ pathLength }}
        />
      </svg>
      <Odometer clock value={formatClock(left)} className={cn('text-[3.25rem] font-extrabold tracking-tight transition-colors duration-300', hurry && 'text-destructive')} />
    </div>
  )
}
