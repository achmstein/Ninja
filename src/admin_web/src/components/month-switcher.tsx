import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'

/** yyyy-MM a number of months from another */
export function shiftMonthKey(monthKey: string, by: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1 + by, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** This month, as yyyy-MM */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * ‹ October 2026 ›: one month at a time, never past the last one there is
 * (this month by default). One switcher where attendance, payslips, expenses
 * and profit each had their own.
 */
export function MonthSwitcher({
  monthKey,
  onChange,
  max = currentMonthKey(),
}: {
  /** yyyy-MM */
  monthKey: string
  onChange: (monthKey: string) => void
  max?: string
}) {
  const t = useT()
  const locale = useLocale()
  const [y, m] = monthKey.split('-').map(Number)
  const label = new Date(y, m - 1, 1).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
  })
  return (
    <div className='flex items-center gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-9'
        aria-label={t('previousMonth')}
        onClick={() => onChange(shiftMonthKey(monthKey, -1))}
      >
        <ChevronLeft className='size-4 rtl:-scale-x-100' />
      </Button>
      <span className='min-w-36 text-center text-sm font-medium'>{label}</span>
      <Button
        variant='ghost'
        size='icon'
        className='size-9'
        aria-label={t('nextMonth')}
        disabled={monthKey >= max}
        onClick={() => onChange(shiftMonthKey(monthKey, 1))}
      >
        <ChevronRight className='size-4 rtl:-scale-x-100' />
      </Button>
    </div>
  )
}
