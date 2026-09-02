import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, MessageSquare, X } from 'lucide-react'
import { getOrderOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'

type OrderDetailDialogProps = {
  /** The order to show; null keeps the dialog closed. */
  orderNumber: number | null
  onOpenChange: (open: boolean) => void
  onConfirm: (orderNumber: number) => void
  onCancel: (orderNumber: number) => void
}

/**
 * What the customer actually ordered, for the cashier who wants to look
 * before accepting: every item with its options and instructions, the note,
 * the total. Confirm is the primary action; cancelling takes a second tap,
 * because the customer is told and there is no way back from it.
 */
export function OrderDetailDialog({
  orderNumber,
  onOpenChange,
  onConfirm,
  onCancel,
}: OrderDetailDialogProps) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()
  const open = orderNumber != null
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!open) setCancelling(false)
  }, [open])

  const { data: order, isLoading } = useQuery({
    ...getOrderOptions({
      path: { orderId: orderNumber ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: open,
  })

  const loyaltyDiscount = toNumber(order?.loyaltyDiscount)
  const place = localized(order?.roomName) || localized(order?.tableName)
  const who = order?.guestName || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[95svh] gap-4 overflow-y-auto sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='text-xl'>
            {t('orderNumber', { id: orderNumber ?? 0 })}
          </DialogTitle>
          {(place || who) && (
            <DialogDescription className='text-base'>
              {[place, who].filter(Boolean).join(' · ')}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading || !order ? (
          <div className='flex flex-col gap-2'>
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-5 w-2/3' />
            <Skeleton className='h-5 w-1/2' />
          </div>
        ) : (
          <>
            <div className='flex flex-col gap-2'>
              {(order.orderItems ?? []).map((item, index) => (
                <div key={index}>
                  <div className='flex items-baseline justify-between gap-3'>
                    <span className='text-base font-medium'>
                      {toNumber(item.units)}× {localized(item.productName)}
                    </span>
                    <span className='text-muted-foreground shrink-0 tabular-nums'>
                      {money(toNumber(item.unitPrice) * toNumber(item.units))}
                    </span>
                  </div>
                  {localized(item.customizationsDescription) && (
                    <div className='text-muted-foreground text-sm'>
                      {localized(item.customizationsDescription)}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <div className='text-muted-foreground text-sm italic'>
                      "{item.specialInstructions}"
                    </div>
                  )}
                </div>
              ))}
            </div>

            {order.customerNote && (
              <div className='bg-muted flex items-start gap-2 rounded-lg p-3 text-sm'>
                <MessageSquare className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                <span>{order.customerNote}</span>
              </div>
            )}

            <Separator />

            <div className='flex flex-col gap-1'>
              {loyaltyDiscount > 0 && (
                <div className='text-muted-foreground flex justify-between text-sm'>
                  <span>{t('loyaltyDiscount')}</span>
                  <span className='tabular-nums'>−{money(loyaltyDiscount)}</span>
                </div>
              )}
              <div className='flex justify-between text-lg font-semibold'>
                <span>{t('total')}</span>
                <span className='tabular-nums'>{money(order.total)}</span>
              </div>
            </div>
          </>
        )}

        {cancelling ? (
          <>
            <p className='text-destructive text-base'>{t('cancelOrderConfirm')}</p>
            <DialogFooter className='gap-2'>
              <Button
                variant='outline'
                size='lg'
                className='h-12'
                onClick={() => setCancelling(false)}
              >
                {t('keepOrder')}
              </Button>
              <Button
                variant='destructive'
                size='lg'
                className='h-12'
                onClick={() => orderNumber != null && onCancel(orderNumber)}
              >
                <X className='size-5' />
                {t('cancelOrder')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogFooter className='gap-2'>
            <Button
              variant='outline'
              size='lg'
              className='text-destructive hover:text-destructive h-12'
              disabled={!order}
              onClick={() => setCancelling(true)}
            >
              <X className='size-5' />
              {t('cancelOrder')}
            </Button>
            <Button
              size='lg'
              className='h-12 px-6'
              disabled={!order}
              onClick={() => orderNumber != null && onConfirm(orderNumber)}
            >
              <Check className='size-5' />
              {t('confirmOrder')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
