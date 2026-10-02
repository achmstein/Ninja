import type { ReactNode } from 'react'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

/**
 * An amount, the admin's one way: in the business's currency, figures of one
 * width so a column lines up, and coloured by sign when it says something
 * (a refund, a balance owed). An optional second line sits small and muted
 * under it ("of 120.00", "refunded 20.00").
 */
export function Money({
  value,
  signed = false,
  tone = 'none',
  strong = false,
  dashZero = false,
  sub,
  className,
}: {
  value: number | string | null | undefined
  /** A + before a positive amount, a − before a negative one */
  signed?: boolean
  /** auto: green when positive, red when negative; negative: always red; none: the text colour */
  tone?: 'auto' | 'negative' | 'none'
  strong?: boolean
  /** An em dash for nothing rather than 0.00 */
  dashZero?: boolean
  sub?: ReactNode
  className?: string
}) {
  const n = toNumber(value)
  const text =
    dashZero && n === 0
      ? '—'
      : `${signed && n > 0 ? '+' : ''}${n < 0 ? '−' : ''}${formatEgp(Math.abs(n))}`
  const colour =
    tone === 'negative' || (tone === 'auto' && n < 0)
      ? 'text-destructive'
      : tone === 'auto' && n > 0
        ? 'text-success'
        : undefined
  return (
    <span
      className={cn(
        'inline-flex flex-col items-end text-end leading-tight',
        className
      )}
    >
      <span
        className={cn(
          'whitespace-nowrap tabular-nums',
          strong && 'font-semibold',
          colour
        )}
      >
        {text}
      </span>
      {sub && (
        <span className='text-muted-foreground text-xs whitespace-nowrap tabular-nums'>
          {sub}
        </span>
      )}
    </span>
  )
}
