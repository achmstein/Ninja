import { useEffect, useRef, useState } from 'react'
import type { TicketDetail } from '@ninja/api/sales/types.gen'
import type { StayViewModel } from '@ninja/api/spaces/types.gen'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { pendingForTicket, usePendingOrders } from '@/features/orders/use-pending-orders'
import { useStayActions } from '@/features/places/use-places'
import { ReceiptSheet, type ReceiptPayment } from '@/features/receipt/receipt-sheet'
import { SettleDialog, type SettleOutcome } from '@/features/ticket/settle-dialog'
import { useOnlinePayments } from '@/features/ticket/use-online-payments'

/**
 * Taking the money for an open bill, over the order screen it was rung up on.
 *
 * Two things stand before it. A running clock: its time is not on the bill
 * yet, so the only way on is to end the session. An order from the app still
 * waiting to be accepted: it may be stale, so the cashier may settle past it,
 * told once. Then the payment itself, the same one the bill's own page takes,
 * and the receipt it prints.
 */
export function BillPayment({
  ticket,
  title,
  stay,
  runningStay,
  open,
  onOpenChange,
  onPaid,
}: {
  ticket: TicketDetail
  title: string
  /** The bill's stay, running or ended: its people are tabs the bill can go on */
  stay: StayViewModel | undefined
  runningStay: StayViewModel | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Paid and looked over: where the till goes next is the screen's to say */
  onPaid: () => void
}) {
  const t = useT()
  const ticketId = toNumber(ticket.id)
  const stayActions = useStayActions()
  const online = useOnlinePayments(ticketId, ticket.status !== 'Settled' && ticket.voidedAt == null)
  const { pending } = usePendingOrders()
  const waiting = pendingForTicket(pending, ticket)
  // The cashier was told about the waiting orders and goes on
  const [past, setPast] = useState(false)
  // Read by the dialog's own closing, which runs before the state has caught up
  const goingOn = useRef(false)
  const [outcome, setOutcome] = useState<SettleOutcome | null>(null)
  useEffect(() => {
    if (!open) {
      setPast(false)
      goingOn.current = false
    }
  }, [open])

  const stage = !open ? null : runningStay ? 'clock' : waiting.length > 0 && !past && !outcome ? 'waiting' : 'pay'
  // What the receipt shows right after settling, before the settled bill is read back
  const paymentsOverride: ReceiptPayment[] | undefined = outcome && !ticket.settledAt ? outcome.payments : undefined

  return (
    <>
      <ConfirmDialog
        open={stage === 'clock'}
        onOpenChange={(next) => !next && onOpenChange(false)}
        title={t('settleWithSessionTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('endSessionButton')}
        destructive
        onAction={() => {
          if (runningStay) stayActions.endStay(toNumber(runningStay.id))
          onOpenChange(false)
        }}
      />
      <ConfirmDialog
        open={stage === 'waiting'}
        onOpenChange={(next) => !next && !goingOn.current && onOpenChange(false)}
        title={t('settleWithPendingTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('settleAnyway')}
        destructive
        onAction={() => {
          goingOn.current = true
          setPast(true)
        }}
      />
      <SettleDialog
        ticket={ticket}
        title={title}
        onlinePayments={online.payments}
        members={stay?.members}
        open={stage === 'pay'}
        onOpenChange={(next) => {
          if (next) return
          // Paid, the bill is done; left unpaid, the cashier is back on its order
          if (outcome) onPaid()
          else onOpenChange(false)
        }}
        onSettled={setOutcome}
      />
      {outcome && (
        <ReceiptSheet
          ticket={ticket}
          paymentsOverride={paymentsOverride}
          receiptNumberOverride={outcome.receiptNumber}
        />
      )}
    </>
  )
}
