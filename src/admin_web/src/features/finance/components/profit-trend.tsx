import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { oldestFirst, profitBase } from '../profit-math'

type Month = {
  year: number | string
  month: number | string
  netSales: number | string
  goods: number | string
  labour: number | string
  expenses: number | string
  profit: number | string
  netSalesExVat?: number | string
}

/**
 * The last months side by side, oldest on the left: what each sold (net
 * sales without its VAT, the base profit is on) and what it kept, as bars,
 * profit in green or red under its sales. Hovering a month gives its costs,
 * which add up to its profit; a click opens it. A trend is what this
 * answers at a glance, where a table of six rows and six figures had to be
 * read.
 */
export function ProfitTrend({
  months,
  selected,
  onSelect,
}: {
  months: Month[]
  selected: string
  onSelect: (monthKey: string) => void
}) {
  const t = useT()
  const locale = useLocale()
  // The API lists the newest first; time reads left to right
  const rows = oldestFirst(months).map((m) => {
    const key = `${m.year}-${String(m.month).padStart(2, '0')}`
    return {
      key,
      label: new Date(
        toNumber(m.year),
        toNumber(m.month) - 1,
        1
      ).toLocaleDateString(locale, { month: 'short' }),
      sales: profitBase(m),
      profit: toNumber(m.profit),
      goods: toNumber(m.goods),
      labour: toNumber(m.labour),
      expenses: toNumber(m.expenses),
    }
  })
  const compact = (value: number) =>
    new Intl.NumberFormat(locale, { notation: 'compact' }).format(value)

  const config = {
    sales: { label: t('netSalesExVat'), color: 'var(--chart-2)' },
    profit: { label: t('profitLabel'), color: 'var(--success)' },
  } satisfies ChartConfig

  return (
    <Card className='gap-2'>
      <CardHeader>
        <CardTitle>{t('profitTrend')}</CardTitle>
      </CardHeader>
      <CardContent className='px-2 sm:px-6'>
        <ChartContainer config={config} className='aspect-auto h-60 w-full'>
          <BarChart
            data={rows}
            margin={{ top: 8, left: 0, right: 8, bottom: 0 }}
            barGap={4}
            onClick={(state) => {
              const key = state?.activeLabel
                ? rows.find((r) => r.label === state.activeLabel)?.key
                : undefined
              if (key) onSelect(key)
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='label'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={compact}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
              content={({ active, payload }) => {
                const row = active ? payload?.[0]?.payload : undefined
                if (!row) return null
                const line = (label: string, value: number, strong = false) => (
                  <div className='flex justify-between gap-6'>
                    <span className='text-muted-foreground'>{label}</span>
                    <span
                      className={
                        strong
                          ? value < 0
                            ? 'text-destructive font-semibold tabular-nums'
                            : 'font-semibold tabular-nums'
                          : 'tabular-nums'
                      }
                    >
                      {formatEgp(value)}
                    </span>
                  </div>
                )
                return (
                  <div className='bg-background grid min-w-48 gap-1 rounded-lg border px-3 py-2 text-xs shadow-xl'>
                    <div className='font-medium'>{row.label}</div>
                    {line(t('netSalesExVat'), row.sales)}
                    {line(t('goodsWasteShrinkage'), row.goods)}
                    {line(t('labourCost'), row.labour)}
                    {line(t('operatingExpenses'), row.expenses)}
                    {line(t('profitLabel'), row.profit, true)}
                  </div>
                )
              }}
            />
            <Bar
              dataKey='sales'
              radius={[4, 4, 0, 0]}
              className='cursor-pointer'
            >
              {rows.map((r) => (
                <Cell
                  key={r.key}
                  fill='var(--color-sales)'
                  fillOpacity={r.key === selected ? 1 : 0.45}
                />
              ))}
            </Bar>
            <Bar
              dataKey='profit'
              radius={[4, 4, 0, 0]}
              className='cursor-pointer'
            >
              {rows.map((r) => (
                <Cell
                  key={r.key}
                  fill={
                    r.profit < 0 ? 'var(--destructive)' : 'var(--color-profit)'
                  }
                  fillOpacity={r.key === selected ? 1 : 0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
