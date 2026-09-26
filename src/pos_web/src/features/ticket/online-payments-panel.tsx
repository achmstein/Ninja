import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { Loader2, Smartphone, Undo2 } from 'lucide-react'
import {
  cancelOnlinePaymentMutation,
  refundOnlinePaymentMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { OnlinePaymentView } from '@/api/sales/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { OnlineSummary } from './online-payments'

/**
 * What guests paid on this bill from their phones, one row each: who (the
 * name they gave), their share of the bill, the tip on top, and where it
 * stands. A guest still at the checkout reads "Paying…" and holds the
 * settle. While the bill is open a paid one can be given back.
 */
export function OnlinePaymentsPanel({
  payments,
  summary,
  billOpen,
}: {
  payments: OnlinePaymentView[]
  summary: OnlineSummary
  billOpen: boolean
}) {
  const t = useT()
  const money = useMoney()
  const locale = useLocale()
  const queryClient = useQueryClient()
  const [refunding, setRefunding] = useState<OnlinePaymentView | null>(null)

  const refund = useMutation({
    ...refundOnlinePaymentMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listOnlinePayments' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      toast.success(t('onlineRefunded'))
    },
    onError: (error) => {
      // A 400 carries the server's own words (the bill closed meanwhile,
      // the provider said no)
      const detail =
        error instanceof AxiosError
          ? (error.response?.data as { detail?: string } | undefined)?.detail
          : undefined
      toast.error(t('onlineRefundFailed'), detail ? { description: detail } : undefined)
    },
  })

  // A guest who closed the checkout without paying or declining holds their
  // share until the hold runs out; the till can let it go now
  const release = useMutation({
    ...cancelOnlinePaymentMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'listOnlinePayments' }] })
      toast.success(t('onlineReleased'))
    },
    onError: () => toast.error(t('onlineReleaseFailed')),
  })

  if (payments.length === 0) return null

  const time = (at: string | null) =>
    at
      ? new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(at))
      : null

  return (
    <div className='mt-4 flex flex-col gap-2'>
      <h2 className='text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase'>
        <Smartphone className='size-4' />
        {t('paidOnlineTitle')}
      </h2>
      <div className='divide-y rounded-lg border'>
        {payments.map((payment) => {
          const tip = toNumber(payment.tip)
          const status = payment.status
          return (
            <div
              key={payment.key}
              className={cn(
                'flex items-center gap-3 px-3 py-2',
                status === 'Refunded' && 'text-muted-foreground'
              )}
            >
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='truncate font-medium'>
                    {payment.payerName || t('onlineGuest')}
                  </span>
                  <Badge
                    variant={
                      status === 'Paid'
                        ? 'secondary'
                        : status === 'Pending'
                          ? 'outline'
                          : 'destructive'
                    }
                    className='shrink-0'
                  >
                    {status === 'Pending' && (
                      <Loader2 className='size-3 animate-spin' />
                    )}
                    {status === 'Paid'
                      ? t('onlinePaid')
                      : status === 'Pending'
                        ? t('onlinePaying')
                        : t('onlineRefundedBadge')}
                  </Badge>
                </div>
                <div className='text-muted-foreground text-xs tabular-nums'>
                  {[
                    time(payment.refundedAt ?? payment.paidAt ?? payment.createdAt),
                    payment.transactionId && `#${payment.transactionId}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <div className='flex shrink-0 flex-col items-end'>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    status === 'Refunded' && 'line-through'
                  )}
                >
                  {money(payment.amount)}
                </span>
                {tip > 0 && (
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {t('onlineTip', { amount: money(tip) })}
                  </span>
                )}
              </div>
              {billOpen && status === 'Pending' && (
                <Button
                  variant='outline'
                  size='sm'
                  className='shrink-0'
                  disabled={release.isPending}
                  onClick={() =>
                    release.mutate({
                      path: { key: payment.key },
                      query: { 'api-version': API_VERSION },
                    })
                  }
                >
                  {t('onlineRelease')}
                </Button>
              )}
              {billOpen && status === 'Paid' && (
                <Button
                  variant='ghost'
                  size='icon'
                  className='text-destructive hover:text-destructive size-10 shrink-0'
                  aria-label={t('onlineRefund')}
                  disabled={refund.isPending}
                  onClick={() => setRefunding(payment)}
                >
                  <Undo2 className='size-4' />
                </Button>
              )}
            </div>
          )
        })}
        <div className='flex items-center justify-between gap-4 px-3 py-2'>
          <span className='text-muted-foreground'>{t('paidOnlineTotal')}</span>
          <span className='font-semibold tabular-nums'>{money(summary.paid)}</span>
        </div>
        {billOpen && (
          <div className='flex items-center justify-between gap-4 px-3 py-2 text-lg'>
            <span className='text-muted-foreground'>{t('remaining')}</span>
            <span
              className={cn(
                'font-bold tabular-nums',
                summary.remaining > 0
                  ? 'text-destructive'
                  : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {money(summary.remaining)}
            </span>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={refunding !== null}
        onOpenChange={(open) => !open && setRefunding(null)}
        title={t('onlineRefundTitle', {
          name: refunding?.payerName || t('onlineGuest'),
        })}
        description={
          refunding
            ? // Everything the guest was charged goes back: share, fee and tip
              money(
                toNumber(refunding.amount) +
                  toNumber(refunding.fee) +
                  toNumber(refunding.tip)
              )
            : undefined
        }
        cancelLabel={t('goBack')}
        actionLabel={t('onlineRefund')}
        destructive
        onAction={() => {
          if (!refunding) return
          refund.mutate({
            path: { key: refunding.key },
            query: { 'api-version': API_VERSION },
          })
        }}
      />
    </div>
  )
}
