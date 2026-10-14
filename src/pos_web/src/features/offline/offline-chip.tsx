import { useState } from 'react'
import { AlertTriangle, CloudOff, Loader2, RotateCw, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLocale, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { useNetworkStatus } from '@/lib/network-status'
import { cn } from '@/lib/utils'
import {
  discardOfflineSale,
  drainOfflineSales,
  retryOfflineSale,
  useOfflineQueue,
} from './offline-queue'
import type { OfflineSale } from './offline-replay'

/**
 * Header chip: shows while the server is out of reach, or while sales taken
 * offline are still waiting to go in. Tap → the list of those sales: each
 * one's provisional number, time and total, why it failed if it did, and a
 * retry or a discard.
 */
export function OfflineChip() {
  const t = useT()
  const online = useNetworkStatus((s) => s.online)
  const sales = useOfflineQueue((s) => s.sales)
  const failed = sales.some((s) => s.status === 'failed')
  const [open, setOpen] = useState(false)

  if (online && sales.length === 0) return null

  return (
    <>
      <Button
        variant='outline'
        className={cn(
          'h-12 gap-2 px-3',
          (!online || failed) && 'border-amber-500/60 text-amber-700 dark:text-amber-400',
        )}
        onClick={() => setOpen(true)}
      >
        {failed ? (
          <AlertTriangle className='size-5' />
        ) : (
          <CloudOff className='size-5' />
        )}
        <span className='max-sm:hidden'>{online ? t('offlineSalesWaiting') : t('offline')}</span>
        {sales.length > 0 && (
          <span className='bg-muted rounded-full px-2 text-sm tabular-nums'>
            {sales.length}
          </span>
        )}
      </Button>
      <OfflineSalesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}

function OfflineSalesDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const online = useNetworkStatus((s) => s.online)
  const { sales, draining } = useOfflineQueue()
  const [discarding, setDiscarding] = useState<OfflineSale | null>(null)
  const queued = sales.some((s) => s.status === 'queued')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] gap-4 overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='text-xl'>{t('offlineSales')}</DialogTitle>
          <DialogDescription className='text-base'>
            {online ? t('offlineSalesOnlineHint') : t('offlineSalesOfflineHint')}
          </DialogDescription>
        </DialogHeader>

        {sales.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center'>
            {t('offlineSalesNone')}
          </p>
        ) : (
          <div className='flex flex-col divide-y rounded-lg border'>
            {sales.map((sale) => (
              <OfflineSaleRow
                key={sale.id}
                sale={sale}
                busy={draining}
                onRetry={() => void retryOfflineSale(sale.id)}
                onDiscard={() => setDiscarding(sale)}
              />
            ))}
          </div>
        )}

        {online && queued && (
          <Button
            size='lg'
            className='h-12 text-base'
            disabled={draining}
            onClick={() => void drainOfflineSales()}
          >
            {draining ? (
              <Loader2 className='size-5 animate-spin' />
            ) : (
              <RotateCw className='size-5' />
            )}
            {t('offlineSendNow')}
          </Button>
        )}

        <ConfirmDialog
          open={discarding !== null}
          onOpenChange={(next) => !next && setDiscarding(null)}
          title={t('offlineDiscardTitle', {
            number: discarding?.provisionalReceiptNumber ?? '',
          })}
          description={t('offlineDiscardHint')}
          cancelLabel={t('cancel')}
          actionLabel={t('offlineDiscard')}
          destructive
          onAction={() => {
            if (discarding) void discardOfflineSale(discarding.id)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function OfflineSaleRow({
  sale,
  busy,
  onRetry,
  onDiscard,
}: {
  sale: OfflineSale
  busy: boolean
  onRetry: () => void
  onDiscard: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const money = useMoney()
  const failed = sale.status === 'failed'

  return (
    <div className='flex items-center gap-3 p-3'>
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-2'>
          <span className='font-semibold tabular-nums'>
            {sale.provisionalReceiptNumber}
          </span>
          <span className='text-muted-foreground text-sm'>
            {new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
              new Date(sale.placedAt),
            )}
          </span>
        </div>
        <div
          className={cn(
            'text-sm',
            failed ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {failed ? sale.error || t('somethingWentWrong') : t('offlineQueued')}
        </div>
      </div>
      <span className='font-semibold tabular-nums'>{money(sale.total)}</span>
      {failed && (
        <>
          <Button
            variant='outline'
            size='icon'
            className='size-11'
            disabled={busy}
            aria-label={t('offlineRetry')}
            onClick={onRetry}
          >
            <RotateCw className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='text-destructive size-11'
            aria-label={t('offlineDiscard')}
            onClick={onDiscard}
          >
            <Trash2 className='size-4' />
          </Button>
        </>
      )}
    </div>
  )
}
