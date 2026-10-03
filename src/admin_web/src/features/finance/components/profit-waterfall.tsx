import { motion } from 'motion/react'
import { useT } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { cn } from '@/lib/utils'
import { SPRING } from '@/components/motion'

type Step = {
  key: string
  label: string
  value: number
  kind: 'total' | 'cost' | 'result'
}

/**
 * Where the month's money went, as a waterfall: what the business sold, each
 * cost taking its bite off it, and what is left. One look says which cost is
 * the big one, which a statement of lines does not. The bars grow in turn.
 */
export function ProfitWaterfall({
  sales,
  goods,
  labour,
  expenses,
  shares = 0,
  profit,
}: {
  sales: number
  goods: number
  labour: number
  expenses: number
  /** What partners take, when there are partners */
  shares?: number
  profit: number
}) {
  const t = useT()
  const steps: Step[] = [
    { key: 'sales', label: t('netSales'), value: sales, kind: 'total' },
    { key: 'goods', label: t('costOfGoods'), value: goods, kind: 'cost' },
    { key: 'labour', label: t('labourCost'), value: labour, kind: 'cost' },
    {
      key: 'expenses',
      label: t('operatingExpenses'),
      value: expenses,
      kind: 'cost',
    },
    ...(shares > 0
      ? [
          {
            key: 'shares',
            label: t('partnersShare'),
            value: shares,
            kind: 'cost' as const,
          },
        ]
      : []),
    { key: 'profit', label: t('profitLabel'), value: profit, kind: 'result' },
  ]
  const top = Math.max(sales, 1)
  // Each cost hangs from where the money stood after the ones before it
  let level = sales
  const bars = steps.map((step) => {
    if (step.kind === 'total') return { ...step, from: 0, to: step.value }
    if (step.kind === 'result')
      return {
        ...step,
        from: Math.min(0, step.value),
        to: Math.max(0, step.value),
      }
    const bar = { ...step, from: level - step.value, to: level }
    level -= step.value
    return bar
  })
  const pct = (v: number) => `${(Math.max(0, Math.min(v, top)) / top) * 100}%`

  return (
    <div className='grid gap-2.5'>
      {bars.map((bar, i) => (
        <div
          key={bar.key}
          className='grid grid-cols-[minmax(6rem,9rem)_1fr_auto] items-center gap-3 text-sm'
        >
          <span
            className={cn(
              'truncate',
              bar.kind !== 'cost' ? 'font-medium' : 'text-muted-foreground'
            )}
          >
            {bar.label}
          </span>
          <div className='bg-muted/50 relative h-7 overflow-hidden rounded-md'>
            <motion.div
              className={cn(
                'absolute inset-y-0 rounded-md',
                bar.kind === 'total' && 'bg-foreground',
                bar.kind === 'cost' && 'bg-destructive/70',
                bar.kind === 'result' &&
                  (bar.value < 0 ? 'bg-destructive' : 'bg-success')
              )}
              style={{ insetInlineStart: pct(bar.from) }}
              initial={{ width: 0 }}
              animate={{ width: pct(bar.to - bar.from) }}
              transition={{ ...SPRING, delay: i * 0.08 }}
            />
          </div>
          <span
            className={cn(
              'w-28 text-end tabular-nums',
              bar.kind === 'cost' && 'text-muted-foreground',
              bar.kind === 'result' && 'font-semibold',
              bar.kind === 'result' && bar.value < 0 && 'text-destructive'
            )}
          >
            {bar.kind === 'cost' ? '−' : ''}
            {formatEgp(bar.value)}
            {bar.kind === 'cost' && sales > 0 && (
              <span className='ms-1.5 text-xs'>
                {Math.round((bar.value / sales) * 100)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
