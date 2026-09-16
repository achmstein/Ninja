import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Award, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  createAccountMutation,
  getAccountOptions,
  getTierInfoOptions,
  getTransactionsOptions,
} from '@/api/loyalty/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { BackHeader } from '@/components/back-header'
import { RequireAuth } from '@/components/require-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'

const pointsFormat = new Intl.NumberFormat('en-US')

export const Route = createFileRoute('/loyalty')({
  component: () => (
    <RequireAuth>
      <LoyaltyPage />
    </RequireAuth>
  ),
})

const transactionTypeKeys: Record<string, TranslationKey> = {
  purchase: 'transactionTypePurchase',
  bonus: 'transactionTypeBonus',
  referral: 'transactionTypeReferral',
  promotion: 'transactionTypePromotion',
  redemption: 'transactionTypeRedemption',
  adjustment: 'transactionTypeAdjustment',
}

const tierKeys: Record<string, TranslationKey> = {
  bronze: 'tierBronze',
  silver: 'tierSilver',
  gold: 'tierGold',
  platinum: 'tierPlatinum',
}

function LoyaltyPage() {
  const t = useT()
  const auth = useAuth()
  const queryClient = useQueryClient()
  const language = useLanguage((s) => s.language)
  const userId = auth.user?.profile?.sub ?? ''

  // App parity (_formatDate): relative for the first week, then "MMM d"
  const [nowMs] = useState(() => Date.now())
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

  const accountQuery = useQuery({
    ...getAccountOptions({
      path: { userId },
      query: { 'api-version': API_VERSION },
    }),
    enabled: !!userId,
    retry: false,
  })
  const account = accountQuery.data
  const hasAccount = !accountQuery.isError && account != null

  const { data: tiers = [] } = useQuery({
    ...getTierInfoOptions({ query: { 'api-version': API_VERSION } }),
    enabled: hasAccount,
  })

  const { data: transactions = [] } = useQuery({
    ...getTransactionsOptions({
      path: { userId },
      query: { 'api-version': API_VERSION, max: 50 },
    }),
    enabled: hasAccount && !!userId,
  })

  const joinProgram = useMutation({
    ...createAccountMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getAccount' }] })
      toast.success(t('success'))
    },
    onError: () => toast.error(t('anErrorOccurred')),
  })

  // Still resolving whether this user has an account — hold a skeleton so the
  // membership card never flashes at 0 points before the join CTA appears
  if (accountQuery.isLoading) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <BackHeader title={t('loyaltyRewards')} />
        <Skeleton className='h-40 rounded-xl' />
      </div>
    )
  }

  // Join CTA when no loyalty account exists yet
  if (accountQuery.isError) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <BackHeader title={t('loyaltyRewards')} />
        <div className='flex h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center'>
        <Award className='text-muted-foreground/40 h-12 w-12' />
        <h1 className='text-xl font-bold'>{t('joinOurLoyaltyProgram')}</h1>
        <Button
          size='lg'
          className='rounded-full px-8'
          disabled={joinProgram.isPending}
          onClick={() =>
            joinProgram.mutate({
              body: { userId },
              query: { 'api-version': API_VERSION },
            })
          }
        >
          {joinProgram.isPending && (
            <Loader2 className='me-2 h-4 w-4 animate-spin' />
          )}
          {t('joinNow')}
        </Button>
        </div>
      </div>
    )
  }

  const lifetime = Number(account?.lifetimePoints ?? 0)
  const currentTier = (account?.currentTier ?? 'Bronze').toLowerCase()
  const sortedTiers = [...tiers].sort(
    (a, b) => Number(a.pointsRequired) - Number(b.pointsRequired)
  )
  const nextTier = sortedTiers.find((tier) => Number(tier.pointsRequired) > lifetime)
  const progress = nextTier
    ? Math.min(100, Math.round((lifetime / Number(nextTier.pointsRequired)) * 100))
    : 100

  return (
    <div className='flex flex-col gap-4 p-4'>
      <BackHeader title={t('loyaltyRewards')} />

      {/* Membership card */}
      <div className='bg-primary text-primary-foreground flex flex-col items-center gap-1 rounded-xl p-6 shadow-sm'>
        <Award className='h-8 w-8' />
        <div className='text-4xl font-bold tabular-nums'>
          {Number(account?.pointsBalance ?? 0)}
        </div>
        <div className='text-sm opacity-90'>{t('pointsBalance')}</div>
        <div className='mt-2 flex gap-4 text-xs opacity-75'>
          {/* The key carries its own "{points}" placeholder and label */}
          <span>{t('lifetimePoints', { points: lifetime })}</span>
          <span>
            ·{' '}
            {tierKeys[currentTier] ? t(tierKeys[currentTier]) : account?.currentTier}
          </span>
        </div>
      </div>

      {/* Progress to next tier */}
      {nextTier && (
        <Card className='gap-2 p-4'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>
              {t('pointsToNextTier', {
                points: Number(nextTier.pointsRequired) - lifetime,
                tier: nextTier.name,
              })}
            </span>
            <span className='tabular-nums'>
              {lifetime} / {Number(nextTier.pointsRequired)}
            </span>
          </div>
          <div className='bg-muted h-2 overflow-hidden rounded-full'>
            <div
              className='bg-primary h-full rounded-full transition-all'
              style={{ width: `${progress}%` }}
            />
          </div>
        </Card>
      )}

      <h2 className='text-base font-semibold'>{t('recentActivity')}</h2>
      {transactions.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('noTransactionsYet')}
        </p>
      ) : (
        /* App parity: plain rows with dividers; a tinted points pill leads
           each row — +green for points earned, −red for points spent */
        <div className='divide-y'>
          {transactions.map((tx) => {
            const points = Number(tx.points ?? 0)
            const earned = points >= 0
            const typeKey = transactionTypeKeys[(tx.type ?? '').toLowerCase()]
            return (
              <div key={String(tx.id)} className='flex items-start gap-3 py-3'>
                <span
                  className={`w-24 shrink-0 rounded-md px-2 py-1 text-center text-sm font-semibold tabular-nums ${
                    earned
                      ? 'bg-green-600/10 text-green-600 dark:text-green-500'
                      : 'bg-destructive/10 text-destructive'
                  }`}
                >
                  {earned ? '+' : '−'}
                  {pointsFormat.format(Math.abs(points))}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-baseline justify-between gap-2'>
                    <span className='text-[15px] font-medium'>
                      {typeKey ? t(typeKey) : tx.type}
                    </span>
                    {tx.createdAt && (
                      <span className='text-muted-foreground shrink-0 text-xs'>
                        {relativeDate(tx.createdAt)}
                      </span>
                    )}
                  </div>
                  {tx.description && (
                    <div className='text-muted-foreground line-clamp-2 text-[13px]'>
                      {tx.description}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
