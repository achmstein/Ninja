import { Award } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useLocale, useT } from '@/lib/i18n'
import { type LoyaltyTier, type LoyaltyStats, tierColors } from '../types'
import { tierNameKeys } from './tier-name'

interface LoyaltyTierBreakdownProps {
  stats: LoyaltyStats | undefined
  isLoading: boolean
}

const tierOrder: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'platinum']

const tierPointsRequired: Record<LoyaltyTier, number> = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000,
}

export function LoyaltyTierBreakdown({ stats, isLoading }: LoyaltyTierBreakdownProps) {
  const t = useT()
  const locale = useLocale()

  return (
    <div>
      <h3 className='mb-4 text-lg font-semibold'>{t('tiers')}</h3>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
        {tierOrder.map((tier) => {
          const count = stats?.accountsByTier?.[tier] ?? 0
          const color = tierColors[tier]
          const pointsRequired = tierPointsRequired[tier]

          return (
            <Card key={tier}>
              <CardContent className='pt-6'>
                {isLoading ? (
                  <div className='flex flex-col items-center gap-2'>
                    <div className='h-12 w-12 animate-pulse rounded-full bg-muted' />
                    <div className='h-4 w-16 animate-pulse rounded bg-muted' />
                    <div className='h-6 w-8 animate-pulse rounded bg-muted' />
                  </div>
                ) : (
                  <div className='flex flex-col items-center gap-2'>
                    <div
                      className='flex h-12 w-12 items-center justify-center rounded-full'
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Award className='h-6 w-6' style={{ color }} />
                    </div>
                    <span className='font-semibold' style={{ color }}>
                      {t(tierNameKeys[tier])}
                    </span>
                    <span className='text-2xl font-bold'>{count}</span>
                    <span className='text-xs text-muted-foreground'>
                      {pointsRequired === 0
                        ? t('startingTier')
                        : `${pointsRequired.toLocaleString(locale)}+ ${t('points')}`}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
