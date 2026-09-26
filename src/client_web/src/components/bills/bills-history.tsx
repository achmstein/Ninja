import { type OrderSummary } from '@/api/ordering'
import { type BillView } from '@/api/sales'
import { closedAt } from '@/lib/bills'
import { dayStartHour, isOvernightShift, useSelectedBranch } from '@/lib/branch'
import { useLanguage, useT } from '@/lib/i18n'
import { SectionLabel } from '@/components/ninja/page/parts'
import { BillCard } from './bill-card'

/** Earlier bills grouped by business day (shift-aware, like the app) */
export function HistoryList({ bills, ordersById }: { bills: BillView[]; ordersById?: Map<number, OrderSummary> }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branch = useSelectedBranch()

  // For overnight shifts, a bill closed before the start hour belongs to
  // the previous day's shift (same rule as the mobile app)
  const startHour = dayStartHour(branch)
  const overnight = isOvernightShift(branch)
  const shiftDay = (date: Date): Date => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    if (overnight && date.getHours() < startHour) day.setDate(day.getDate() - 1)
    return day
  }
  const todayShift = shiftDay(new Date())
  const yesterdayShift = new Date(todayShift)
  yesterdayShift.setDate(yesterdayShift.getDate() - 1)

  const labelFor = (day: Date): string => {
    if (day.getTime() === todayShift.getTime()) return t('today')
    if (day.getTime() === yesterdayShift.getTime()) return t('yesterday')
    return day.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
  }

  const groups: Array<{ label: string; bills: BillView[] }> = []
  for (const bill of bills) {
    const closed = closedAt(bill)
    const label = closed ? labelFor(shiftDay(closed)) : ''
    const group = groups.at(-1)
    if (group && group.label === label) {
      group.bills.push(bill)
    } else {
      groups.push({ label, bills: [bill] })
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      {groups.map((group) => (
        <div key={group.label} className='flex flex-col gap-2'>
          <SectionLabel>{group.label}</SectionLabel>
          <div className='flex flex-col gap-3'>
            {group.bills.map((bill) => (
              <BillCard key={String(bill.id)} bill={bill} ordersById={ordersById} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

