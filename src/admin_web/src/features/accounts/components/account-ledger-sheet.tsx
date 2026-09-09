import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocale, useT } from '@/lib/i18n'
import { formatEgp } from '@/features/orders/status'
import { accountsService } from '../services/accounts-service'
import type { AccountSummary } from '../types'

interface AccountLedgerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountSummary | null
  onRecordPayment: () => void
}

export function AccountLedgerSheet({
  open,
  onOpenChange,
  account,
  onRecordPayment,
}: AccountLedgerSheetProps) {
  const t = useT()
  const locale = useLocale()
  const { data: fullAccount, isLoading } = useQuery({
    queryKey: ['account', account?.customerId],
    queryFn: () => accountsService.getAccount(account!.customerId),
    enabled: open && !!account,
  })

  const balance = fullAccount?.balance ?? account?.balance ?? 0
  const transactions = [...(fullAccount?.transactions ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{account?.customerName || t('customer')}</SheetTitle>
          <SheetDescription>{t('accountLedger')}</SheetDescription>
        </SheetHeader>

        <div className='flex-1 px-4 pb-4'>
          {/* Balance */}
          <div className='flex flex-col items-center gap-1 py-4'>
            <span
              className={`text-3xl font-bold tabular-nums ${
                balance > 0
                  ? 'text-red-500'
                  : balance < 0
                    ? 'text-green-600'
                    : ''
              }`}
            >
              {formatEgp(Math.abs(balance))}
            </span>
            <span className='text-muted-foreground text-sm'>
              {balance > 0
                ? t('owedByCustomer')
                : balance < 0
                  ? t('customerCredit')
                  : t('settled')}
            </span>
          </div>

          <Separator />

          {/* Ledger */}
          {isLoading ? (
            <div className='space-y-3 pt-4'>
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className='h-12' />
              ))}
            </div>
          ) : transactions.length === 0 ? (
            <div className='text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm'>
              <Wallet className='h-8 w-8 opacity-40' />
              {t('noTransactionsYet')}
            </div>
          ) : (
            <div className='divide-y'>
              {transactions.map((transaction) => {
                const isCharge = transaction.type === 'charge'
                return (
                  <div
                    key={transaction.id}
                    className='flex items-center gap-3 py-3'
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        isCharge
                          ? 'bg-red-100 text-red-600 dark:bg-red-950'
                          : 'bg-green-100 text-green-600 dark:bg-green-950'
                      }`}
                    >
                      {isCharge ? (
                        <ArrowUpRight className='h-4 w-4' />
                      ) : (
                        <ArrowDownLeft className='h-4 w-4' />
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='truncate text-sm font-medium'>
                        {transaction.source === 'posReceipt' &&
                        transaction.sourceNumber != null
                          ? t('posReceipt', { number: transaction.sourceNumber })
                          : transaction.source === 'posCreditNote' &&
                              transaction.sourceNumber != null
                            ? t('posCreditNote', {
                                number: transaction.sourceNumber,
                              })
                            : transaction.description ||
                              (isCharge ? t('charge') : t('payment'))}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {new Date(transaction.createdAt).toLocaleString(locale)}{' '}
                        · {t('byName', { name: transaction.recordedBy })}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold tabular-nums ${
                        isCharge ? 'text-red-500' : 'text-green-600'
                      }`}
                    >
                      {isCharge ? '+' : '−'}
                      {formatEgp(transaction.amount)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {balance > 0 && (
          <SheetFooter className='border-t'>
            <Button className='w-full' onClick={onRecordPayment}>
              <CreditCard className='me-2 h-4 w-4' />
              {t('recordPayment')}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
