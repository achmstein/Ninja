import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowDownLeft, ArrowUpRight, Check, ChevronRight, CircleAlert, Wallet } from 'lucide-react'
import { type TransactionViewModel } from '@/api/accounts'
import { getMyAccountOptions, getMyTransactionsOptions } from '@/api/accounts/@tanstack/react-query.gen'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Panel, SectionLabel, Slab } from '@/components/ninja/page/parts'
import { Odometer } from '@/components/ninja/odometer'
import { RequireAuth } from '@/components/require-auth'
import { RequireFeature } from '@/components/require-feature'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, usePrice, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/account')({
  component: () => (
    <RequireFeature feature='tabs'>
      <RequireAuth>
        <AccountPage />
      </RequireAuth>
    </RequireFeature>
  ),
})

// App parity: amounts in the ledger always use western digits ('#,##0.00')
const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** The house tab: the balance on the dock's slab, and what moved it underneath. */
function AccountPage() {
  const t = useT()
  const accountQuery = useQuery({ ...getMyAccountOptions(), retry: false })
  const { data: transactions = [], isLoading } = useQuery({
    ...getMyTransactionsOptions({ query: { limit: 50 } }),
    enabled: !accountQuery.isError,
  })
  const balance = accountQuery.isError ? 0 : Number(accountQuery.data?.balance ?? 0)
  // Snapshot per visit (lint-safe render purity; the page isn't long-lived)
  const [nowMs] = useState(() => Date.now())

  return (
    <NinjaPage title={t('transactions')} back='/profile' push={{ id: 'account', icon: Wallet }}>
      {accountQuery.isLoading ? (
        <Skeleton className='h-40 rounded-[1.75rem]' />
      ) : (
        <Rise className='flex flex-col gap-5'>
          <RiseItem>
            <BalanceSlab balance={balance} />
          </RiseItem>
          <RiseItem className='flex flex-col gap-2'>
            <SectionLabel>{t('recentActivity')}</SectionLabel>
            {isLoading ? (
              <Skeleton className='h-48 rounded-[1.5rem]' />
            ) : transactions.length === 0 ? (
              <Panel>
                <p className='text-muted-foreground py-8 text-center text-sm'>{t('noTransactionsYet')}</p>
              </Panel>
            ) : (
              <Panel className='divide-border/60 flex flex-col divide-y overflow-hidden'>
                {transactions.map((tx) => (
                  <LedgerRow key={String(tx.id)} tx={tx} nowMs={nowMs} />
                ))}
              </Panel>
            )}
          </RiseItem>
        </Rise>
      )}
    </NinjaPage>
  )
}

/**
 * The balance as the page's one big thing, as the app's card has it: red
 * when the customer owes, green when in credit, plain when settled. The
 * slab is dark on a light page and light on a dark one, so each colour
 * takes the shade that reads on it.
 */
function BalanceSlab({ balance }: { balance: number }) {
  const t = useT()
  const price = usePrice()
  const owes = balance > 0
  const hasCredit = balance < 0
  const tone = owes ? 'text-red-400 dark:text-red-600' : hasCredit ? 'text-emerald-400 dark:text-emerald-600' : ''
  const Icon = owes ? CircleAlert : hasCredit ? Check : Wallet

  return (
    <Slab className='flex flex-col gap-2 py-7'>
      {/* A glow of the balance's colour behind it; it does not move */}
      {(owes || hasCredit) && (
        <div
          aria-hidden
          className={cn(
            'pointer-events-none absolute -end-16 -top-20 size-56 rounded-full opacity-30 blur-3xl',
            owes ? 'bg-red-500' : 'bg-emerald-500'
          )}
        />
      )}
      <span className={cn('relative flex items-center gap-2 text-sm font-semibold', tone || 'text-muted-foreground')}>
        <Icon className='size-4' />
        {owes ? t('amountDue') : hasCredit ? t('creditBalance') : t('yourBalance')}
      </span>
      <Odometer value={price(Math.abs(balance))} className={cn('relative text-[40px] font-extrabold', tone)} />
    </Slab>
  )
}

/**
 * One move on the tab: a charge (+, red) or a payment (−, green), what it
 * came from, and when. A charge the till posted from a receipt opens that
 * receipt; the rest of the ledger has nothing behind it to open.
 */
function LedgerRow({ tx, nowMs }: { tx: TransactionViewModel; nowMs: number }) {
  const t = useT()
  const language = useLanguage((s) => s.language)
  const isCharge = (tx.type ?? '').toLowerCase() === 'charge'

  // App parity (_formatDate): relative for the first week, then "MMM d"
  const relativeDate = (iso: string) => {
    const date = new Date(iso)
    const days = Math.floor((nowMs - date.getTime()) / 86_400_000)
    if (days <= 0) return t('today')
    if (days === 1) return t('yesterday')
    if (days < 7) return t('daysAgo', { days })
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })
  }

  const detail =
    tx.source === 'posReceipt' && tx.sourceNumber != null
      ? t('posReceipt', { number: tx.sourceNumber })
      : tx.source === 'posCreditNote' && tx.sourceNumber != null
        ? t('posCreditNote', { number: tx.sourceNumber })
        : tx.source === 'posTabPayment' && tx.sourceNumber != null
          ? t('posTabPayment', { number: tx.sourceNumber })
          : tx.description || (tx.recordedBy ? t('byPerson', { name: tx.recordedBy }) : '')

  const row = (
    <>
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full',
          isCharge ? 'bg-destructive/10 text-destructive' : 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400'
        )}
      >
        {isCharge ? <ArrowUpRight className='size-[18px] rtl:-scale-x-100' /> : <ArrowDownLeft className='size-[18px] rtl:-scale-x-100' />}
      </span>
      <span className='flex min-w-0 flex-1 flex-col'>
        <span className='text-[15px] font-semibold'>{isCharge ? t('charge') : t('payment')}</span>
        <span className='text-muted-foreground line-clamp-2 text-[13px]'>
          {[tx.createdAt && relativeDate(tx.createdAt), detail].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span
        className={cn('shrink-0 text-[15px] font-bold tabular-nums', isCharge ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}
      >
        {isCharge ? '+' : '−'}
        {amountFormat.format(Math.abs(Number(tx.amount ?? 0)))}
      </span>
    </>
  )

  return tx.ticketId != null ? (
    <Link
      to='/receipts/$ticketId'
      params={{ ticketId: String(tx.ticketId) }}
      className='active:bg-muted flex items-center gap-3 px-4 py-3 transition-colors'
    >
      {row}
      <ChevronRight className='text-muted-foreground size-4 shrink-0 rtl:rotate-180' />
    </Link>
  ) : (
    <div className='flex items-center gap-3 px-4 py-3'>{row}</div>
  )
}
