import { ArrowDownRight, ArrowUpRight, Clock, RefreshCw } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { type TranslationKey, useLocale, useT } from '@/lib/i18n'
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
      })
    }
    if (diffDays === 1) {
      return t('yesterday')
    }
    if (diffDays < 7) {
      return t('daysAgo', { days: diffDays })
    }
    return date.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
    })
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
        <div className='flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground'>
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
              <div className='flex h-8 w-8 items-center justify-center rounded-full bg-muted'>
                {getTransactionIcon(transaction.type, transaction.points)}
              </div>
              <div className='flex-1 min-w-0'>
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium'>
                    {getTransactionLabel(transaction.type)}
                  </span>
                  {transaction.referenceId && (
                    <span className='text-xs text-muted-foreground'>
                      #{transaction.referenceId.slice(0, 8)}
                    </span>
                  )}
                </div>
                <p className='text-xs text-muted-foreground truncate'>
                  {transaction.description}
                </p>
              </div>
              <div className='text-right'>
                <span
                  className={`text-sm font-medium ${
                    transaction.points > 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {transaction.points > 0 ? '+' : ''}
                  {transaction.points.toLocaleString(locale)}
                </span>
                <p className='text-xs text-muted-foreground'>
                  {formatDate(transaction.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
