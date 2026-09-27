import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { Odometer } from '../odometer'

/**
 * Points as a ring: the balance in the middle, rolling like the tray's total,
 * and the ring drawn round as far as the member has come towards the next
 * tier. The ring draws once, when it arrives.
 */
export function PointsRing({
  points,
  progress,
  label,
  size = 104,
  className,
}: {
  points: number
  /** 0 to 1 */
  progress: number
  label: string
  size?: number
  className?: string
}) {
  const stroke = 8
  const r = (size - stroke) / 2
  return (
    <div className={cn('relative grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='absolute inset-0 -rotate-90' aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill='none' stroke='currentColor' strokeOpacity={0.14} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill='none'
          stroke='currentColor'
          className='text-amber-400'
          strokeWidth={stroke}
          strokeLinecap='round'
          initial={{ pathLength: 0 }}
          animate={{ pathLength: Math.max(0.02, progress) }}
          transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.15 }}
        />
      </svg>
      <div className='flex flex-col items-center leading-none'>
        <Odometer value={String(points)} className='text-2xl font-extrabold' />
        <span className='mt-1 text-[11px] font-semibold opacity-60'>{label}</span>
      </div>
    </div>
  )
}
