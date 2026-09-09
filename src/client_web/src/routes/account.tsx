import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  getMyAccountOptions,
  getMyTransactionsOptions,
} from '@/api/accounts/@tanstack/react-query.gen'
import { BackHeader } from '@/components/back-header'
import { BalanceCard } from '@/components/balance-card'
import { RequireAuth } from '@/components/require-auth'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, useT } from '@/lib/i18n'

export const Route = createFileRoute('/account')({
  component: () => (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  ),
})

// App parity: amounts in the ledger always use western digits ('#,##0.00')
const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** House account: running balance + charge/payment ledger (mobile parity). */
function AccountPage() {
  const t = useT()
  const language = useLanguage((s) => s.language)

  const accountQuery = useQuery({ ...getMyAccountOptions(), retry: false })
  const { data: transactions = [] } = useQuery({
    ...getMyTransactionsOptions({ query: { limit: 50 } }),
    enabled: !accountQuery.isError,
  })

  const balance = Number(accountQuery.data?.balance ?? 0)

  // Snapshot per visit (lint-safe render purity; the page isn't long-lived)
  const [nowMs] = useState(() => Date.now())

  // App parity (_formatDate): relative for the first week, then "MMM d"
  const relativeDate = (iso: string) => {
    const date = new Date(iso)
    const days = Math.floor((nowMs - date.getTime()) / 86_400_000)
    if (days <= 0) return t('today')
    if (days === 1) return t('yesterday')
    if (days < 7) return t('daysAgo', { days })
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <BackHeader title={t('transactions')} />

      {accountQuery.isLoading ? (
        <Skeleton className='h-32 rounded-2xl' />
      ) : (
        <BalanceCard balance={accountQuery.isError ? 0 : balance} />
      )}

      {transactions.length > 0 && (
        <>
          <h2 className='text-base font-semibold'>{t('recentActivity')}</h2>
          {/* App parity: plain rows with dividers; a tinted amount pill leads
              each row — +red for charges, −green for payments */}
          <div className='divide-y'>
            {transactions.map((tx) => {
              const isCharge = (tx.type ?? '').toLowerCase() === 'charge'
              return (
                <div key={String(tx.id)} className='flex items-start gap-3 py-3'>
                  <span
                    className={`w-24 shrink-0 rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums ${
                      isCharge
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-600/10 text-green-600 dark:text-green-500'
                    }`}
                  >
                    {isCharge ? '+' : '−'}
                    {amountFormat.format(Math.abs(Number(tx.amount ?? 0)))}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-baseline justify-between gap-2'>
                      <span className='text-[15px] font-medium'>
                        {isCharge ? t('charge') : t('payment')}
                      </span>
                      {tx.createdAt && (
                        <span className='text-muted-foreground shrink-0 text-xs'>
                          {relativeDate(tx.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className='text-muted-foreground line-clamp-2 text-[13px]'>
                      {tx.source === 'posReceipt' && tx.sourceNumber != null
                        ? t('posReceipt', { number: tx.sourceNumber })
                        : tx.source === 'posCreditNote' &&
                            tx.sourceNumber != null
                          ? t('posCreditNote', { number: tx.sourceNumber })
                          : tx.source === 'posTabPayment' &&
                              tx.sourceNumber != null
                            ? t('posTabPayment', { number: tx.sourceNumber })
                          : tx.description ||
                            (tx.recordedBy
                              ? t('byPerson', { name: tx.recordedBy })
                              : '')}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
