import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CloudOff, Loader2, Pencil, RotateCw } from 'lucide-react'
import {
  getTicketByOrderOptions,
  getTicketOptions,
} from '@/api/sales/@tanstack/react-query.gen'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useOfflineCharge } from '@/features/offline/offline-charge'
import { counterBill, NO_PRICING } from '@/features/offline/pricing'
import { useBranchPricing } from '@/features/offline/use-branch-pricing'
import { saleTotal, useSale } from '@/features/sale/cart'
import { API_VERSION } from '@/lib/api-client'
import { translate, useLanguage, useT } from '@/lib/i18n'
import { useMoney } from '@/lib/money'
import { toast } from '@/lib/toast'
import { dropSend, sendOrder, useSending } from './sending'
import { SendingLines } from './sending-lines'

// The counter ticket materializes off the order-confirmed event, so the
// order → ticket lookup 404s for a moment. Poll fast (a cashier is standing
// there); the SignalR TicketUpdated invalidation short-circuits the wait.
const TICKET_POLL_INTERVAL_MS = 600
const TICKET_POLL_TIMEOUT_MS = 12_000

/**
 * A new counter sale, the moment it is charged: the bill as the till prices
 * it, its lines on their way, and the Pay button saying it is confirming.
 * When the server's ticket appears this hands over to it, with the payment
 * dialog open, as the pad used to after its wait. A charge that never got in
 * stays here, red, with a retry, the way back to the pad, and — when the
 * connection was the trouble — the offline sale.
 */
export function SendingTicket({ requestId }: { requestId: string }) {
  const t = useT()
  const money = useMoney()
  const language = useLanguage((s) => s.language)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const send = useSending((s) => s.sends.find((x) => x.requestId === requestId))
  const pricing = useBranchPricing() ?? NO_PRICING
  const offlineCharge = useOfflineCharge()

  // Nothing here: confirmed or removed in another tab, an old link, or taken
  // offline (once its dialog is done with the receipt)
  const takingOffline = offlineCharge.element != null
  // Set once this screen sends the cashier on itself, so that letting go of
  // the send on the way out does not send them to the floor instead
  const leaving = useRef(false)
  useEffect(() => {
    if (!send && !takingOffline && !leaving.current) navigate({ to: '/', replace: true })
  }, [send, takingOffline, navigate])

  const orderId = send?.status === 'placed' ? send.orderId : null
  const ticketLookup = useQuery({
    ...getTicketByOrderOptions({
      path: { orderId: orderId ?? 0 },
      query: { 'api-version': API_VERSION },
    }),
    enabled: orderId != null,
    retry: false,
    refetchInterval: TICKET_POLL_INTERVAL_MS,
    staleTime: 0,
    gcTime: 0,
  })
  const foundTicketId = ticketLookup.data ? Number(ticketLookup.data.ticketId) : null

  // The ticket is there: read it first, so the bill never flashes empty, then
  // over to it with the payment open
  useEffect(() => {
    if (foundTicketId == null) return
    let cancelled = false
    const options = getTicketOptions({
      path: { id: foundTicketId },
      query: { 'api-version': API_VERSION },
    })
    void queryClient
      .prefetchQuery(options)
      .catch(() => {})
      .then(() => {
        if (cancelled) return
        leaving.current = true
        dropSend(requestId)
        queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
        navigate({
          to: '/ticket/$ticketId',
          params: { ticketId: String(foundTicketId) },
          search: { settle: true },
          replace: true,
        })
      })
    return () => {
      cancelled = true
    }
  }, [foundTicketId, requestId, navigate, queryClient])

  // In but its ticket slow to show: the kitchen has it, and the bill turns
  // up on the floor over SignalR. A plain timer, so the wait can never hang
  // on the polling machinery.
  const placedAt = send?.status === 'placed' ? send.startedAt : null
  useEffect(() => {
    if (placedAt == null) return
    const handle = setTimeout(
      () => {
        dropSend(requestId)
        toast.warning(translate('ticketNotReadyYet'))
        navigate({ to: '/', replace: true })
      },
      Math.max(0, TICKET_POLL_TIMEOUT_MS - (Date.now() - placedAt)),
    )
    return () => clearTimeout(handle)
  }, [placedAt, requestId, navigate])

  if (!send) return offlineCharge.element

  const failed = send.status === 'failed'
  const bill = counterBill(saleTotal(send.lines), pricing)
  // The offline sale takes only what needs nobody's say: no account behind it
  const sellsOffline = failed && send.offline && send.body.customerUserId == null
  const BackIcon = language === 'ar' ? ArrowRight : ArrowLeft

  // Back on the pad as it was charged, for the cashier to change or charge again
  const backToSale = () => {
    leaving.current = true
    useSale.setState({
      target: null,
      lines: send.lines,
      note: send.note,
      customer: send.customer,
      delivery: null,
    })
    dropSend(requestId)
    navigate({ to: '/sale', replace: true })
  }

  const takeOffline = () =>
    offlineCharge.start({
      requestId,
      lines: send.lines,
      note: send.note,
      customerName: send.customer?.name.trim() || null,
      onQueued: () => dropSend(requestId),
    })

  return (
    <div className='mx-auto flex max-w-3xl flex-col px-4 pt-3 pb-[calc(7.5rem+env(safe-area-inset-bottom))]'>
      <div className='flex items-center gap-2'>
        <Button asChild variant='ghost' size='icon' className='size-12'>
          <Link to='/' aria-label={t('backToFloor')}>
            <BackIcon className='size-6' />
          </Link>
        </Button>
        <h1 className='flex min-w-0 flex-1 items-baseline gap-2 text-xl font-bold'>
          <span className='truncate'>{send.customer?.name || t('counter')}</span>
          <span className='text-muted-foreground shrink-0 text-base font-medium'>
            {t('newTicket')}
          </span>
        </h1>
      </div>

      <Separator className='my-3' />

      <SendingLines sends={[send]} />

      <div className='bg-background/95 fixed inset-x-0 bottom-0 z-30 border-t p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur'>
        <div className='mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2'>
          <div className='min-w-0'>
            <div className='text-muted-foreground text-sm'>{t('total')}</div>
            <div className='text-2xl font-bold tabular-nums'>{money(bill.total)}</div>
          </div>
          <div className='ms-auto flex gap-2 max-sm:w-full'>
            {failed ? (
              <>
                <Button
                  variant='outline'
                  size='lg'
                  className='h-14 gap-2 px-5 text-lg max-sm:h-12 max-sm:flex-1 max-sm:px-3 max-sm:text-base'
                  onClick={backToSale}
                >
                  <Pencil className='size-5' />
                  {t('backToSale')}
                </Button>
                {sellsOffline && (
                  <Button
                    variant='outline'
                    size='lg'
                    className='h-14 gap-2 px-5 text-lg max-sm:h-12 max-sm:flex-1 max-sm:px-3 max-sm:text-base'
                    onClick={takeOffline}
                  >
                    <CloudOff className='size-5' />
                    {t('sellOffline')}
                  </Button>
                )}
                <Button
                  size='lg'
                  className='h-14 gap-2 px-6 text-lg max-sm:h-12 max-sm:flex-1 max-sm:px-3 max-sm:text-base'
                  onClick={() => void sendOrder(requestId)}
                >
                  <RotateCw className='size-5' />
                  {t('offlineRetry')}
                </Button>
              </>
            ) : (
              // The money waits for the server's bill: never taken against one it has not got
              <Button size='lg' className='h-14 gap-2 px-8 text-lg max-sm:flex-1' disabled>
                <Loader2 className='size-5 animate-spin' />
                {t('confirming')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {offlineCharge.element}
    </div>
  )
}
