import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'
import {
  getMyAccountOptions,
  getMyTransactionsOptions,
} from '@/api/accounts/@tanstack/react-query.gen'
import { RequireAuth } from '@/components/require-auth'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, useLocalized, usePrice, useT } from '@/lib/i18n'

export const Route = createFileRoute('/account')({
  component: () => (
    <RequireAuth>
      <AccountPage />
    </RequireAuth>
  ),
})

/** House account: running balance + charge/payment ledger (mobile parity). */
function AccountPage() {
  const t = useT()
  const price = usePrice()
  const language = useLanguage((s) => s.language)
  useLocalized() // keep hook order stable with other pages

  const accountQuery = useQuery({ ...getMyAccountOptions(), retry: false })
  const { data: transactions = [] } = useQuery({
    ...getMyTransactionsOptions({ query: { limit: 50 } }),
    enabled: !accountQuery.isError,
  })

  const balance = Number(accountQuery.data?.balance ?? 0)
  const owes = balance > 0

  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>
        {t('transactions')}
      </h1>

      {accountQuery.isLoading ? (
        <Skeleton className='h-32 rounded-xl' />
      ) : accountQuery.isError || balance === 0 ? (
        <Card className='items-center gap-2 p-6 text-center'>
          <Wallet className='text-muted-foreground/40 h-8 w-8' />
          <p className='text-muted-foreground text-sm'>
            {t('noOutstandingBalance')}
          </p>
        </Card>
      ) : (
        <Card className='items-center gap-1 p-6 text-center'>
          <div className='text-muted-foreground text-sm'>
            {owes ? t('amountDue') : t('creditBalance')}
          </div>
          <div
            className={`text-3xl font-bold tabular-nums ${owes ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
          >
            {price(Math.abs(balance))}
          </div>
          <p className='text-muted-foreground text-xs'>
            {owes ? t('pleasePayAtCounter') : t('willBeAppliedToNextPurchase')}
          </p>
        </Card>
      )}

      {transactions.length > 0 && (
        <>
          <h2 className='text-muted-foreground text-sm font-semibold'>
            {t('recentActivity')}
          </h2>
          <div className='flex flex-col gap-2'>
            {transactions.map((tx) => {
              const isCharge = (tx.type ?? '').toLowerCase() === 'charge'
              const Icon = isCharge ? ArrowUpCircle : ArrowDownCircle
              return (
                <Card
                  key={String(tx.id)}
                  className='flex-row items-center gap-3 p-3 text-sm'
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${isCharge ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate font-medium'>
                      {tx.description || (isCharge ? t('charge') : t('payment'))}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {tx.createdAt &&
                        new Date(tx.createdAt).toLocaleString(
                          language === 'ar' ? 'ar-EG' : 'en-US',
                          { dateStyle: 'medium', timeStyle: 'short' }
                        )}
                      {tx.recordedBy &&
                        ` · ${t('byPerson', { name: tx.recordedBy })}`}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${isCharge ? 'text-destructive' : 'text-green-600 dark:text-green-500'}`}
                  >
                    {isCharge ? '+' : '−'}
                    {price(Math.abs(Number(tx.amount ?? 0)))}
                  </span>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
