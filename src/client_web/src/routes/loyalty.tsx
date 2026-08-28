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
import { RequireAuth } from '@/components/require-auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useT, type TranslationKey } from '@/lib/i18n'

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
  const userId = auth.user?.profile?.sub ?? ''

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

  // Join CTA when no loyalty account exists yet
  if (accountQuery.isError) {
    return (
      <div className='flex h-[70svh] flex-col items-center justify-center gap-4 px-6 text-center'>
        <Award className='text-muted-foreground/40 h-12 w-12' />
        <h1 className='text-xl font-bold'>{t('joinOurLoyaltyProgram')}</h1>
        <p className='text-muted-foreground text-sm'>
          {t('earnPointsDescription')}
        </p>
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
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>
        {t('loyaltyRewards')}
      </h1>

      {/* Membership card */}
      <div className='bg-primary text-primary-foreground flex flex-col items-center gap-1 rounded-xl p-6 shadow-sm'>
        <Award className='h-8 w-8' />
        <div className='text-4xl font-bold tabular-nums'>
          {Number(account?.pointsBalance ?? 0)}
        </div>
        <div className='text-sm opacity-90'>{t('pointsBalance')}</div>
        <div className='mt-2 flex gap-4 text-xs opacity-75'>
          <span>
            {t('lifetimePoints')}: {lifetime}
          </span>
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

      <h2 className='text-muted-foreground text-sm font-semibold'>
        {t('recentActivity')}
      </h2>
      {transactions.length === 0 ? (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          {t('noTransactionsYet')}
        </p>
      ) : (
        <div className='flex flex-col gap-2'>
          {transactions.map((tx) => {
            const points = Number(tx.points ?? 0)
            const typeKey = transactionTypeKeys[(tx.type ?? '').toLowerCase()]
            return (
              <Card
                key={String(tx.id)}
                className='flex-row items-center justify-between gap-2 p-3 text-sm'
              >
                <div className='min-w-0'>
                  <div className='truncate font-medium'>
                    {tx.description || (typeKey ? t(typeKey) : tx.type)}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {tx.createdAt && new Date(tx.createdAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`shrink-0 font-bold tabular-nums ${points >= 0 ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}
                >
                  {points >= 0 ? '+' : ''}
                  {points} {t('pts')}
                </span>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
