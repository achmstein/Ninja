import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ninja, the assistant: a hood with only the eye slit open and the
 * headband's tails off its side, in the colour of whatever it sits in. It
 * stands wherever the AI does something ("Propose with Ninja", "Fill in with
 * Ninja", a field Ninja filled). `working`: the tails flutter and the hood
 * bobs while Ninja is at it, quick, in place of a spinner; still under
 * reduced motion (styles/index.css).
 */
export function NinjaMark({
  working = false,
  className,
}: {
  working?: boolean
  className?: string
}) {
  const slit = useId()
  return (
    <svg
      viewBox='0 0 24 24'
      aria-hidden
      className={cn('ninja-mark', working && 'ninja-mark-working', className)}
    >
      <mask id={slit}>
        <rect width='24' height='24' fill='white' />
        <rect x='5' y='10.2' width='12' height='4' rx='2' fill='black' />
      </mask>
      <g className='ninja-mark-hood'>
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
        className='ninja-mark-tails'
        fill='none'
        stroke='currentColor'
        strokeWidth='2'
        strokeLinecap='round'
      >
        <path d='M18.6 11 L22.4 8.2' />
        <path d='M18.6 11.8 L22.6 13.8' />
      </g>
    </svg>
  )
}
