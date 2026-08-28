import { useState } from 'react'
import { Award, Plus, RefreshCw, TrendingUp, Calendar } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useLocale, useT } from '@/lib/i18n'
import { useLoyaltyTransactions } from '../hooks/use-loyalty'
import { LoyaltyTransactionList } from './loyalty-transaction-list'
import { EarnPointsDialog } from './earn-points-dialog'
import { AdjustPointsDialog } from './adjust-points-dialog'
import {
  type LoyaltyAccount,
  tierColors,
  getNextTier,
} from '../types'
import { tierNameKeys } from './tier-name'

interface LoyaltyAccountSheetProps {
  account: LoyaltyAccount | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const tierPointsRequired: Record<string, number> = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 10000,
}

export function LoyaltyAccountSheet({
  account,
  open,
  onOpenChange,
}: LoyaltyAccountSheetProps) {
  const t = useT()
  const locale = useLocale()
  const [earnDialogOpen, setEarnDialogOpen] = useState(false)
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)

  const { data: transactions, isLoading: transactionsLoading } =
    useLoyaltyTransactions(account?.userId ?? '')

  if (!account) return null

  const tierColor = tierColors[account.currentTier]
  const tierName = t(tierNameKeys[account.currentTier])
  const nextTier = getNextTier(account.currentTier)
  const nextTierName = nextTier ? t(tierNameKeys[nextTier]) : ''
  const nextTierPoints = nextTier ? tierPointsRequired[nextTier] : null
  const progressToNextTier = nextTierPoints
    ? Math.min(
        100,
        Math.round((account.lifetimePoints / nextTierPoints) * 100)
      )
    : 100

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className='flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-2'>
              <Award className='h-5 w-5' style={{ color: tierColor }} />
              {account.userDisplayName || t('loyaltyAccount')}
            </SheetTitle>
            <SheetDescription className='font-mono text-xs'>
              {account.userId}
            </SheetDescription>
          </SheetHeader>

          <div className='space-y-6 px-4 pb-6'>
            {/* Tier Badge */}
            <div className='flex items-center justify-center'>
              <Badge
                className='gap-2 px-4 py-2 text-lg'
                style={{
                  backgroundColor: `${tierColor}20`,
                  borderColor: tierColor,
                  color: tierColor,
                }}
                variant='outline'
              >
                <Award className='h-5 w-5' />
                {t('tierMember', { tier: tierName })}
              </Badge>
            </div>

            {/* Points Summary */}
            <div className='grid grid-cols-2 gap-4'>
              <div className='rounded-lg bg-muted p-4 text-center'>
                <div className='text-2xl font-bold'>
                  {account.pointsBalance.toLocaleString(locale)}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {t('pointsBalance')}
                </div>
              </div>
              <div className='rounded-lg bg-muted p-4 text-center'>
                <div className='text-2xl font-bold'>
                  {account.lifetimePoints.toLocaleString(locale)}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {t('lifetimePoints')}
                </div>
              </div>
            </div>

            {/* Next Tier Progress */}
            {nextTier && nextTierPoints && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span className='flex items-center gap-1 text-muted-foreground'>
                    <TrendingUp className='h-3 w-3' />
                    {t('progressToTier', { tier: nextTierName })}
                  </span>
                  <span className='font-medium'>
                    {account.lifetimePoints.toLocaleString(locale)} /{' '}
                    {nextTierPoints.toLocaleString(locale)}
                  </span>
                </div>
                <div className='h-2 rounded-full bg-muted overflow-hidden'>
                  <div
                    className='h-full rounded-full transition-all'
                    style={{
                      width: `${progressToNextTier}%`,
                      backgroundColor: tierColors[nextTier],
                    }}
                  />
                </div>
                <p className='text-xs text-muted-foreground text-center'>
                  {nextTierPoints - account.lifetimePoints > 0
                    ? t('pointsToTier', {
                        points: (
                          nextTierPoints - account.lifetimePoints
                        ).toLocaleString(locale),
                        tier: nextTierName,
                      })
                    : t('eligibleForTier', { tier: nextTierName })}
                </p>
              </div>
            )}

            {/* Member Since */}
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              <Calendar className='h-4 w-4' />
              {t('memberSince')} {formatDate(account.createdAt)}
            </div>

            <Separator />

            {/* Actions */}
            <div className='flex gap-2'>
              <Button
                className='flex-1'
                onClick={() => setEarnDialogOpen(true)}
              >
                <Plus className='me-2 h-4 w-4' />
                {t('addPoints')}
              </Button>
              <Button
                variant='outline'
                className='flex-1'
                onClick={() => setAdjustDialogOpen(true)}
              >
                <RefreshCw className='me-2 h-4 w-4' />
                {t('adjust')}
              </Button>
            </div>

            <Separator />

            {/* Transaction History */}
            <LoyaltyTransactionList
              transactions={transactions}
              isLoading={transactionsLoading}
            />
          </div>
        </SheetContent>
      </Sheet>

      <EarnPointsDialog
        open={earnDialogOpen}
        onOpenChange={setEarnDialogOpen}
        userId={account.userId}
      />

      <AdjustPointsDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        userId={account.userId}
        currentBalance={account.pointsBalance}
      />
    </>
  )
}
