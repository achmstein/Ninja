import { useState } from 'react'
import { Award, Phone, User, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useT, type TranslationKey } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { PayTabDialog } from './pay-tab-dialog'
import { useLoyalty, useTab } from './use-customer-card'

/** Someone the till can look up: an identity account, with what it knows of them. */
export type CardCustomer = {
  id: string
  name: string
  phone?: string | null
}

// 100 points = 1 EGP, the same constant Loyalty and Ordering each keep
const POINTS_PER_EGP = 100

const tierKey: Record<string, TranslationKey> = {
  Bronze: 'tierBronze',
  Silver: 'tierSilver',
  Gold: 'tierGold',
  Platinum: 'tierPlatinum',
}

type CustomerCardProps = {
  customer: CardCustomer | null
  onOpenChange: (open: boolean) => void
}

/**
 * The customer in front of the cashier, at a glance: their points (as
 * information — points are earned, joined and spent in the customer app,
 * never at the till) and their tab, which the till can take money against.
 * Opened by tapping the customer wherever they already appear; there is no
 * list of everyone — the back office has that.
 */
export function CustomerCard({ customer, onOpenChange }: CustomerCardProps) {
  const t = useT()
  const money = useMoney()
  const [payOpen, setPayOpen] = useState(false)

  const open = customer !== null
  const loyalty = useLoyalty(customer?.id, open)
  const tab = useTab(customer?.id, open)

  const points = toNumber(loyalty.account?.pointsBalance)
  const tier = loyalty.account?.currentTier ?? ''
  const owed = toNumber(tab.tab?.balance)

  const block = (icon: React.ReactNode, title: string, body: React.ReactNode) => (
    <div className='rounded-xl border p-3'>
      <div className='text-muted-foreground mb-1 flex items-center gap-2 text-sm'>
        {icon}
        {title}
      </div>
      {body}
    </div>
  )

  const failed = (retry: () => void) => (
    <div className='flex items-center justify-between gap-2'>
      <span className='text-muted-foreground text-sm'>{t('somethingWentWrong')}</span>
      <Button variant='outline' size='sm' onClick={retry}>
        {t('retry')}
      </Button>
    </div>
  )

  return (
    <>
      <Dialog open={open && !payOpen} onOpenChange={onOpenChange}>
        <DialogContent className='flex flex-col gap-4 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2 text-xl'>
              <User className='size-5 shrink-0' />
              <span className='truncate'>{customer?.name || t('guest')}</span>
            </DialogTitle>
            {customer?.phone && (
              <p className='text-muted-foreground flex items-center gap-1.5 text-sm' dir='ltr'>
                <Phone className='size-3.5' />
                {customer.phone}
              </p>
            )}
          </DialogHeader>

          {block(
            <Award className='size-4' />,
            t('loyaltyPoints'),
            loyalty.isPending ? (
              <Skeleton className='h-8 w-40' />
            ) : loyalty.isError ? (
              failed(() => loyalty.refetch())
            ) : loyalty.notEnrolled ? (
              <div>
                <div className='font-medium'>{t('notEnrolled')}</div>
                <div className='text-muted-foreground text-sm'>{t('joinsFromApp')}</div>
              </div>
            ) : (
              <div className='flex items-baseline justify-between gap-3'>
                <span>
                  <span className='text-2xl font-bold tabular-nums'>
                    {t('pointsBalance', { points })}
                  </span>
                  <span className='text-muted-foreground ms-2 text-sm tabular-nums'>
                    {t('pointsWorth', { amount: money(points / POINTS_PER_EGP) })}
                  </span>
                </span>
                {tier && (
                  <Badge variant='secondary'>
                    {tierKey[tier] ? t(tierKey[tier]) : tier}
                  </Badge>
                )}
              </div>
            )
          )}

          {block(
            <Wallet className='size-4' />,
            t('tabBalance'),
            tab.isPending ? (
              <Skeleton className='h-8 w-40' />
            ) : tab.isError ? (
              failed(() => tab.refetch())
            ) : tab.noTab ? (
              <div className='font-medium'>{t('noTab')}</div>
            ) : (
              <div className='flex items-center justify-between gap-3'>
                <span
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    owed > 0 ? 'text-destructive' : 'text-emerald-600'
                  )}
                >
                  {owed > 0
                    ? t('owesAmount', { amount: money(owed) })
                    : owed < 0
                      ? t('creditAmount', { amount: money(-owed) })
                      : t('settledUp')}
                </span>
                {/* Taking money needs something owed; a credit is paid back
                    from the back office, never the drawer */}
                <Button
                  className='h-11'
                  disabled={owed <= 0}
                  onClick={() => setPayOpen(true)}
                >
                  {t('payTab')}
                </Button>
              </div>
            )
          )}

          <Button
            variant='outline'
            size='lg'
            className='h-12'
            onClick={() => onOpenChange(false)}
          >
            {t('done')}
          </Button>
        </DialogContent>
      </Dialog>

      {customer && (
        <PayTabDialog
          customer={customer}
          balance={owed}
          open={payOpen}
          onOpenChange={setPayOpen}
        />
      )}
    </>
  )
}
