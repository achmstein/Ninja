import { useMemo, useState } from 'react'
import { startOfMonth } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { type StockLevelView } from '@/api/inventory'
import { getUsageReportOptions } from '@/api/inventory/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { API_VERSION } from '@/lib/api-client'
import { presetWindow } from '@/lib/business-day'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'

type StockStatsProps = {
  levels: StockLevelView[]
}

/**
 * The branch's numbers, folded away by default: what the shelves hold now
 * and what this month has cost. One unboxed row, nothing to click through.
 */
export function StockStats({ levels }: StockStatsProps) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const branchId = useBranchStore((s) => s.branchId)
  const { branches } = useAllowedBranches()
  const branch = branches.find((b) => toNumber(b.id) === branchId)

  const now = useMemo(() => new Date(), [])
  const monthWindow = useMemo(
    () =>
      branch
        ? presetWindow('custom', branch.dayStartTime, branch.dayEndTime, {
            from: startOfMonth(now),
            to: now,
          })
        : null,
    [branch, now]
  )

  // Only fetched once the row is opened
  const report = useQuery({
    ...getUsageReportOptions({
      query: {
        'api-version': API_VERSION,
        from: monthWindow?.from.toISOString() ?? '',
        to: monthWindow?.to.toISOString() ?? '',
      },
    }),
    enabled: open && monthWindow !== null,
  })

  const lowCount = levels.filter((l) => l.isLow).length
  const stockValue = levels.reduce((sum, l) => sum + toNumber(l.value), 0)

  type StatRow = { label: string; value: React.ReactNode; tone?: string }
  // The current numbers need no caption; the period ones carry the month
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    now
  )
  const groups: { title: string | null; stats: StatRow[] }[] = [
    {
      title: null,
      stats: [
        { label: t('inventoryItems'), value: levels.length },
        {
          label: t('lowItems'),
          value: lowCount,
          tone: lowCount > 0 ? 'text-destructive' : undefined,
        },
        { label: t('stockValue'), value: formatEgp(stockValue) },
      ],
    },
    {
      title: monthName,
      stats: [
        {
          label: t('purchased'),
          value: report.data ? formatEgp(report.data.purchasedValue) : null,
        },
        {
          label: t('costOfGoodsSold'),
          value: report.data ? formatEgp(report.data.soldValue) : null,
        },
        {
          label: t('waste'),
          value: report.data ? formatEgp(report.data.wastedValue) : null,
          tone: 'text-destructive',
        },
      ],
    },
  ]

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant='ghost' size='sm' className='-ms-2 h-8 gap-1.5'>
          {t('stats')}
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className='flex flex-wrap items-end gap-x-8 gap-y-4 pt-2 pb-1'>
          {groups.map((group, index) => (
            <div
              key={index}
              className='flex flex-wrap items-end gap-x-8 gap-y-3'
            >
              {group.title && (
                <div className='text-muted-foreground border-s ps-6 text-sm font-medium'>
                  {group.title}
                </div>
              )}
              {group.stats.map((stat) => (
                <div key={stat.label} className='min-w-0'>
                  <div className='text-muted-foreground text-xs'>
                    {stat.label}
                  </div>
                  <div
                    className={cn(
                      'text-lg font-semibold tabular-nums',
                      stat.tone
                    )}
                  >
                    {stat.value === null ? (
                      <Skeleton className='mt-1 h-5 w-20' />
                    ) : (
                      stat.value
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
