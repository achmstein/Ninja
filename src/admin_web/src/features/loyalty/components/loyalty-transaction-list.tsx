import { ArrowDownRight, ArrowUpRight, Clock, RefreshCw } from 'lucide-react'
import { type TranslationKey, useLocale, useT } from '@/lib/i18n'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { When } from '@/components/when'
import type { PointsTransaction } from '../types'

interface LoyaltyTransactionListProps {
  transactions: PointsTransaction[] | undefined
  isLoading: boolean
}

function getTransactionIcon(type: string, points: number) {
  if (type === 'adjustment') {
    return <RefreshCw className='h-4 w-4 text-blue-500' />
  }
  if (points > 0) {
    return <ArrowUpRight className='h-4 w-4 text-green-500' />
  }
  return <ArrowDownRight className='h-4 w-4 text-red-500' />
}

const transactionLabelKeys: Record<string, TranslationKey> = {
  earn: 'transactionTypeEarned',
  redeem: 'transactionTypeRedemption',
  adjustment: 'transactionTypeAdjustment',
  purchase: 'transactionTypePurchase',
  bonus: 'transactionTypeBonus',
  promotion: 'transactionTypePromotion',
  referral: 'transactionTypeReferral',
}

export function LoyaltyTransactionList({
  transactions,
  isLoading,
}: LoyaltyTransactionListProps) {
  const t = useT()
  const locale = useLocale()

  const getTransactionLabel = (type: string): string => {
    const key = transactionLabelKeys[type]
    return key ? t(key) : type
  }

  if (isLoading) {
    return (
      <div className='space-y-3'>
        <h4 className='text-sm font-medium'>{t('history')}</h4>
        <div className='space-y-2'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className='flex items-center gap-3 rounded-lg border p-3'
            >
              <Skeleton className='h-8 w-8 rounded-full' />
              <div className='flex-1 space-y-1'>
                <Skeleton className='h-4 w-24' />
                <Skeleton className='h-3 w-32' />
              </div>
              <Skeleton className='h-4 w-16' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className='space-y-3'>
        <h4 className='text-sm font-medium'>{t('history')}</h4>
        <div className='text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-6'>
          <Clock className='h-8 w-8' />
          <p className='text-sm'>{t('noTransactionsYet')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <h4 className='text-sm font-medium'>{t('history')}</h4>
      <ScrollArea className='h-[300px]'>
        <div className='space-y-2 pe-4'>
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className='flex items-center gap-3 rounded-lg border p-3'
            >
              <div className='bg-muted flex h-8 w-8 items-center justify-center rounded-full'>
                {getTransactionIcon(transaction.type, transaction.points)}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium'>
                    {getTransactionLabel(transaction.type)}
                  </span>
                </div>
                {transaction.description && (
                  <p className='text-muted-foreground truncate text-xs'>
                    {transaction.description}
                  </p>
                )}
              </div>
              <div className='text-end'>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transaction.points > 0 ? '+' : ''}
                  {transaction.points.toLocaleString(locale)}
                </span>
                <When
                  value={transaction.createdAt}
                  className='text-muted-foreground block text-xs'
                />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
