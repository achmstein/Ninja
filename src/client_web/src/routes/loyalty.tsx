import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Award, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import {
  createAccountMutation,
  getAccountOptions,
  getTransactionsOptions,
} from '@/api/loyalty/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Empty, Panel, SectionLabel, Slab } from '@/components/ninja/page/parts'
import { PointsRing } from '@/components/ninja/page/points-ring'
import { RequireAuth } from '@/components/require-auth'
import { RequireFeature } from '@/components/require-feature'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguage, useT, type TranslationKey } from '@/lib/i18n'
import { TIER_KEYS, useTierProgress } from '@/lib/loyalty'
import { cn } from '@/lib/utils'

const pointsFormat = new Intl.NumberFormat('en-US')

export const Route = createFileRoute('/loyalty')({
  component: () => (
    <RequireFeature feature='loyalty'>
      <RequireAuth>
        <LoyaltyPage />
      </RequireAuth>
    </RequireFeature>
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
    },
    onError: () => toast.error(t('anErrorOccurred')),
  })

  const lifetime = Number(account?.lifetimePoints ?? 0)
  const { nextTier, progress } = useTierProgress(lifetime, hasAccount)
  const tier = (account?.currentTier ?? 'Bronze').toLowerCase()

  // Still resolving whether this user has an account: a skeleton, so the
  // card never flashes at 0 points before the way to join appears
  if (accountQuery.isLoading) {
    return (
      <NinjaPage title={t('loyaltyRewards')} back='/profile'>
        <Skeleton className='h-44 rounded-[1.75rem]' />
      </NinjaPage>
    )
  }

  if (accountQuery.isError) {
    return (
      <NinjaPage title={t('loyaltyRewards')} back='/profile'>
        <Empty icon={Award} title={t('joinOurLoyaltyProgram')}>
          <Button
            size='lg'
            className='rounded-full px-8'
            disabled={joinProgram.isPending}
            onClick={() => joinProgram.mutate({ body: { userId }, query: { 'api-version': API_VERSION } })}
          >
            {joinProgram.isPending && <Loader2 className='size-4 animate-spin' />}
            {t('joinNow')}
          </Button>
        </Empty>
      </NinjaPage>
    )
  }

  return (
    <NinjaPage title={t('loyaltyRewards')} back='/profile'>
      <Rise className='flex flex-col gap-5'>
        {/* The balance as a ring round towards the next tier, on the dock's slab */}
        <RiseItem>
          <Slab className='flex flex-col items-center gap-4 py-7 text-center'>
            <PointsRing points={Number(account?.pointsBalance ?? 0)} progress={progress} label={t('pts')} size={148} />
            <div className='flex flex-col items-center gap-1.5'>
              <div className='inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-sm font-bold text-amber-300'>
                <Award className='size-4' />
                {TIER_KEYS[tier] ? t(TIER_KEYS[tier]) : account?.currentTier}
              </div>
              {/* The key carries its own "{points}" placeholder and label */}
              <span className='text-sm opacity-60'>{t('lifetimePoints', { points: lifetime })}</span>
              {nextTier && (
                <span className='text-sm opacity-80'>
                  {t('pointsToNextTier', { points: Number(nextTier.pointsRequired) - lifetime, tier: nextTier.name })}
                </span>
              )}
            </div>
          </Slab>
        </RiseItem>

        <RiseItem className='flex flex-col gap-2'>
          <SectionLabel>{t('recentActivity')}</SectionLabel>
          {transactions.length === 0 ? (
            <Panel>
              <p className='text-muted-foreground py-8 text-center text-sm'>{t('noTransactionsYet')}</p>
            </Panel>
          ) : (
            <Panel className='divide-border/60 flex flex-col divide-y overflow-hidden'>
              {transactions.map((tx) => {
                const points = Number(tx.points ?? 0)
                const earned = points >= 0
                const typeKey = transactionTypeKeys[(tx.type ?? '').toLowerCase()]
                return (
                  <div key={String(tx.id)} className='flex items-center gap-3 px-4 py-3'>
                    <div className='min-w-0 flex-1'>
                      <div className='text-[15px] font-semibold'>{typeKey ? t(typeKey) : tx.type}</div>
                      <div className='text-muted-foreground line-clamp-2 text-[13px]'>
                        {[tx.createdAt && relativeDate(tx.createdAt), tx.description].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {/* Earned in green, spent in red, like the app */}
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                        earned ? 'bg-emerald-600/10 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'
                      )}
                    >
                      {earned ? '+' : '−'}
                      {pointsFormat.format(Math.abs(points))}
                    </span>
                  </div>
                )
              })}
            </Panel>
          )}
        </RiseItem>
      </Rise>
    </NinjaPage>
  )
}
