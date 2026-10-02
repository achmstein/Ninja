import { type OrderSummary } from '@/api/ordering'
import { type BillView } from '@/api/sales'
import { closedAt } from '@/lib/bills'
import { useSelectedBranch } from '@/lib/branch'
import { businessDayDate } from '@/lib/business-day'
import { isSettled } from '@/lib/bills'
import { useLanguage, usePrice, useT } from '@/lib/i18n'
import { SectionLabel } from '@/components/ninja/page/parts'
import { BillCard } from './bill-card'

/** Earlier bills grouped by business day (shift-aware, like the app) */
export function HistoryList({ bills, ordersById }: { bills: BillView[]; ordersById?: Map<number, OrderSummary> }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const branch = useSelectedBranch()

  // A bill closed before the day's start hour belongs to the day before
  const shiftDay = (date: Date): Date => businessDayDate(date, branch)
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


/**
 * The history, month by month: each month a heading with how many visits
 * it held and what was paid in it, then its bills by day under it.
 */
export function BillsByMonth({ bills, ordersById }: { bills: BillView[]; ordersById?: Map<number, OrderSummary> }) {
  const t = useT()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  const months: Array<{ key: string; label: string; bills: BillView[] }> = []
  for (const bill of bills) {
    const closed = closedAt(bill)
    const key = closed ? `${closed.getFullYear()}-${closed.getMonth()}` : ''
    const month = months.at(-1)
    if (month && month.key === key) month.bills.push(bill)
    else
      months.push({
        key,
        label: closed ? closed.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' }) : '',
        bills: [bill],
      })
  }
  return (
    <div className='flex flex-col gap-8'>
      {months.map((month) => {
        const paid = month.bills.filter(isSettled).reduce((sum, bill) => sum + Number(bill.total ?? 0), 0)
        return (
          <section key={month.key} className='flex flex-col gap-3'>
            <div className='flex items-end justify-between gap-3 px-1'>
              <div className='flex flex-col'>
                <h2 className='heading text-title leading-tight'>{month.label}</h2>
                <span className='text-muted-foreground text-caption'>{t('ninjaMonthVisits', { count: String(month.bills.length) })}</span>
              </div>
              <span className='text-headline font-extrabold tabular-nums'>{price(paid)}</span>
            </div>
            <HistoryList bills={month.bills} ordersById={ordersById} />
          </section>
        )
      })}
    </div>
  )
}
