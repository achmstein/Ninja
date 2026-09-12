import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { accountsService } from '@/features/accounts/services/accounts-service'
import { tierNameKeys } from '@/features/loyalty/components/tier-name'
import { useLoyaltyStats } from '@/features/loyalty/hooks/use-loyalty'
import { tierColors, type LoyaltyTier } from '@/features/loyalty/types'
import { formatEgp } from '@/features/orders/status'

const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']

/**
 * The customer-side numbers, folded away by default: what is owed, how
 * many members, points this month, and the tier spread as one bar.
 */
export function CustomerStats() {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)

  const accounts = useQuery({
    queryKey: ['accounts'],
    queryFn: () => accountsService.getAccounts(),
    enabled: open,
  })
  const stats = useLoyaltyStats()

  const owing = (accounts.data ?? []).filter((a) => a.balance > 0)
  const outstanding = owing.reduce((sum, a) => sum + a.balance, 0)
  const byTier = stats.data?.accountsByTier ?? {}
  const members = stats.data?.totalAccounts ?? 0
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date()
  )

  const cells: { label: string; value: React.ReactNode; tone?: string }[] = [
    {
      label: t('totalOutstanding'),
      value: accounts.data ? formatEgp(outstanding) : null,
      tone: outstanding > 0 ? 'text-destructive' : undefined,
    },
    {
      label: t('customersOwing'),
      value: accounts.data ? owing.length : null,
    },
    { label: t('members'), value: stats.data ? members : null },
    {
      label: `${t('pointsIssued')} · ${monthName}`,
      value: stats.data
        ? stats.data.pointsIssuedThisMonth.toLocaleString(locale)
        : null,
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
          {cells.map((cell) => (
            <div key={cell.label} className='min-w-0'>
              <div className='text-muted-foreground text-xs'>{cell.label}</div>
              <div
                className={cn('text-lg font-semibold tabular-nums', cell.tone)}
              >
                {cell.value === null ? (
                  <Skeleton className='mt-1 h-5 w-20' />
                ) : (
                  cell.value
                )}
              </div>
            </div>
          ))}
          {members > 0 && (
            <div className='min-w-64 flex-1'>
              <div className='text-muted-foreground mb-1.5 text-xs'>
                {t('tiers')}
              </div>
              <div className='bg-muted flex h-2 overflow-hidden rounded-full'>
                {tierOrder.map((tier) => {
                  const count = byTier[tier] ?? 0
                  if (!count) return null
                  return (
                    <div
                      key={tier}
                      style={{
                        width: `${(count / members) * 100}%`,
                        backgroundColor: tierColors[tier],
                      }}
                      title={`${t(tierNameKeys[tier])}: ${count}`}
                    />
                  )
                })}
              </div>
              <div className='mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                {tierOrder.map((tier) => (
                  <span key={tier} className='flex items-center gap-1.5'>
                    <span
                      className='size-2 rounded-full'
                      style={{ backgroundColor: tierColors[tier] }}
                    />
                    <span className='text-muted-foreground'>
                      {t(tierNameKeys[tier])}
                    </span>
                    <span className='tabular-nums'>{byTier[tier] ?? 0}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
