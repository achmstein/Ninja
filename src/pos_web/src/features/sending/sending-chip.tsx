import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { saleTotal } from '@/features/sale/cart'
import { useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { dropSend, resumeSends, sendOrder, sweepSends, useSending } from './sending'

/** How often placed orders whose lines never showed are looked over */
const SWEEP_MS = 3_000

/**
 * Header chip, red, while a charge never reached the server: wherever the
 * cashier has gone since, it is in sight. Tap → each one with its bill, why
 * it failed, and a retry or a remove. It also picks up the sends a reload
 * cut off, and lets go of the ones placed long ago.
 */
export function SendingChip() {
  const t = useT()
  const money = useMoney()
  const navigate = useNavigate()
  const sends = useSending((s) => s.sends)
  const failed = sends.filter((x) => x.status === 'failed')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    resumeSends()
    const handle = setInterval(sweepSends, SWEEP_MS)
    return () => clearInterval(handle)
  }, [])

  if (failed.length === 0) return null

  return (
    <>
      <Button
        variant='outline'
        className='border-destructive/60 text-destructive hover:text-destructive h-12 gap-2 px-3'
        onClick={() => setOpen(true)}
      >
        <AlertTriangle className='size-5' />
        <span className='max-sm:hidden'>{t('sendsFailed', { count: failed.length })}</span>
        <span className='bg-destructive/10 rounded-full px-2 text-sm tabular-nums sm:hidden'>
          {failed.length}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{t('notSent')}</DialogTitle>
            <DialogDescription>{t('sendsFailedHint')}</DialogDescription>
          </DialogHeader>
          <div className='flex max-h-[60vh] flex-col divide-y overflow-y-auto rounded-lg border'>
            {failed.map((send) => (
              <div key={send.requestId} className='flex flex-col gap-2 p-3'>
                <button
                  type='button'
                  className='flex items-baseline justify-between gap-3 text-start'
                  onClick={() => {
                    setOpen(false)
                    if (send.ticketId != null) {
                      navigate({
                        to: '/ticket/$ticketId',
                        params: { ticketId: String(send.ticketId) },
                      })
                    } else {
                      navigate({
                        to: '/ticket/sending/$requestId',
                        params: { requestId: send.requestId },
                      })
                    }
                  }}
                >
                  <span className='font-semibold underline-offset-4 hover:underline'>
                    {send.ticketId != null ? `#${send.ticketId}` : t('newTicket')}
                  </span>
                  <span className='font-semibold tabular-nums'>{money(saleTotal(send.lines))}</span>
                </button>
                {send.error && <p className='text-muted-foreground text-sm'>{send.error}</p>}
                <div className='flex justify-end gap-2'>
                  <Button
                    variant='outline'
                    className='h-11 gap-2'
                    onClick={() => dropSend(send.requestId)}
                  >
                    <Trash2 className='size-4' />
                    {t('remove')}
                  </Button>
                  <Button className='h-11 gap-2' onClick={() => void sendOrder(send.requestId)}>
                    <RotateCw className='size-4' />
                    {t('offlineRetry')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
