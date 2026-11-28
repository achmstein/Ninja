import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

// At or under this many days the figure turns red: time to order
const SOON = 2

/**
 * How long an item lasts at the rate the branch uses it: "6 days", "Under a
 * day", or with `left` the sentence "6 days left". Whole days, rounded down:
 * better to order a day early than a day late.
 */
export function DaysLeft({ days, left, className }: { days: number; left?: boolean; className?: string }) {
  const t = useT()
  const text = days < 1 ? t('lessThanADay') : t('daysCount', { count: Math.floor(days) })
  return (
    <span className={cn('tabular-nums', days <= SOON && 'text-destructive font-medium', className)}>
      {left ? t('daysLeftLine', { days: text }) : text}
    </span>
  )
}
