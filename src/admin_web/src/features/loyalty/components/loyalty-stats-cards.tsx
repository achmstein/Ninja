import { Users, Star, TrendingUp, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLocale, useT } from '@/lib/i18n'
import type { LoyaltyStats } from '../types'

interface LoyaltyStatsCardsProps {
  stats: LoyaltyStats | undefined
  isLoading: boolean
}

export function LoyaltyStatsCards({ stats, isLoading }: LoyaltyStatsCardsProps) {
  const t = useT()
  const locale = useLocale()

  const cards = [
    {
      title: t('totalAccounts'),
      value: stats?.totalAccounts ?? 0,
      icon: Users,
      description: t('loyaltyProgramMembers'),
    },
    {
      title: t('todayLabel'),
      value: stats?.pointsIssuedToday ?? 0,
      icon: Star,
      description: t('pointsIssuedToday'),
    },
    {
      title: t('weekLabel'),
      value: stats?.pointsIssuedThisWeek ?? 0,
      icon: TrendingUp,
      description: t('pointsIssuedThisWeek'),
    },
    {
      title: t('monthLabel'),
      value: stats?.pointsIssuedThisMonth ?? 0,
      icon: Calendar,
      description: t('pointsIssuedThisMonth'),
    },
  ]

  return (
    <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-4'>
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
            <CardTitle className='text-sm font-medium'>{card.title}</CardTitle>
            <card.icon className='h-4 w-4 text-muted-foreground' />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className='h-8 w-20 animate-pulse rounded bg-muted' />
            ) : (
              <>
                <div className='text-2xl font-bold'>
                  {card.value.toLocaleString(locale)}
                </div>
                <p className='text-xs text-muted-foreground'>{card.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
