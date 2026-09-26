import { cn } from '@/lib/utils'
import { odometerRuns } from './odometer-runs'

/**
 * A price that rolls to its new value like a counter's wheels. Each wheel is
 * a column of the ten digits moved with a transform, and only on a change,
 * so nothing runs while the price sits still. Wheels are keyed from the end
 * of the number so the units stay the units when a digit is added in front.
 * Reduced motion: no transition, the digit simply swaps.
 */
export function Odometer({ value, className }: { value: string; className?: string }) {
  const runs = odometerRuns(value)
  return (
    <span className={cn('relative inline-block leading-[1.2em] whitespace-nowrap tabular-nums', className)}>
      <span className='sr-only'>{value}</span>
      {runs.map((run, r) =>
        run.kind === 'text' ? (
          <span key={`t${r}`} aria-hidden className='whitespace-pre'>
            {run.value}
          </span>
        ) : (
          <span key={`n${r}`} aria-hidden dir='ltr' className='inline-flex align-top'>
            {run.cells.map((cell, i) => {
              const key = run.cells.length - i
              if (cell.kind === 'mark') return <span key={`m${key}`} className='align-top'>{cell.value}</span>
              return (
                <span key={`d${key}`} className='relative inline-block h-[1.2em] overflow-hidden align-top'>
                  <span className='invisible'>{cell.digits[8]}</span>
                  <span
                    className='absolute inset-x-0 top-0 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none'
                    style={{ transform: `translateY(${-cell.value * 1.2}em)` }}
                  >
                    {[...cell.digits].map((d) => (
                      <span key={d} className='block h-[1.2em] text-center'>
                        {d}
                      </span>
                    ))}
                  </span>
                </span>
              )
            })}
          </span>
        )
      )}
    </span>
  )
}
