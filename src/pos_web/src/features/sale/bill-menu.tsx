import { useState } from 'react'
import { useAuth } from 'react-oidc-context'
import { BadgePercent, Ban, Ellipsis, ListChecks, Printer, Trash2, Undo2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { returnPartPaymentMutation } from '@/api/sales/@tanstack/react-query.gen'
import type { PartPaymentView, TicketDetail } from '@/api/sales/types.gen'
import type { StayViewModel } from '@/api/spaces/types.gen'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getRealmRoles } from '@/config/oidc-config'
import { useStayActions } from '@/features/places/use-places'
import { printSheets } from '@/features/printing/print-sheets'
import { ReceiptSheet } from '@/features/receipt/receipt-sheet'
import { DiscardTicketDialog } from '@/features/ticket/discard-dialog'
import { DiscountDialog } from '@/features/ticket/discount-dialog'
import { KitchenReprintDialog, useCanReprintKitchen } from '@/features/ticket/kitchen-reprint'
import { VoidTicketDialog } from '@/features/ticket/void-dialog'
import { API_VERSION } from '@/lib/api-client'
import { handleServerError } from '@/lib/handle-server-error'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { useMoney, toNumber } from '@/lib/money'
import { orderIdsOn } from '@/lib/stock-disposition'

/**
 * The rest a bill can do, from the sale screen it is rung up on: a discount,
 * the bill on paper, the kitchen's tickets again, and taking it off the floor
 * (discarded while empty, voided by an owner once something is on it). Each
 * opens here, over the sale; splitting or moving lines turns the order's own
 * list into boxes to tick.
 */
export function BillMenu({
  ticket,
  runningStay,
  sending,
  onSelectLines,
}: {
  ticket: TicketDetail
  runningStay: StayViewModel | undefined
  /** Lines charged here are still on their way: nothing empties the bill under them */
  sending: boolean
  /** Picking lines to split off, move to another bill or name: done on the order itself */
  onSelectLines: () => void
}) {
  const t = useT()
  const money = useMoney()
  const auth = useAuth()
  const stayActions = useStayActions()
  const [discountOpen, setDiscountOpen] = useState(false)
  const [reprintOpen, setReprintOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidGuardOpen, setVoidGuardOpen] = useState(false)
  // A part payment an owner is giving back: the money leaves this shift's drawer
  const [givingBack, setGivingBack] = useState<PartPaymentView | null>(null)
  const queryClient = useQueryClient()
  const giveBack = useMutation({
    ...returnPartPaymentMutation(),
    onError: handleServerError,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      toast.success(t('partGivenBack'))
    },
  })
  const isOwner = getRealmRoles(auth.user).includes('Owner')
  const parts = isOwner ? (ticket.partPayments ?? []) : []

  const ticketId = toNumber(ticket.id)
  const lines = ticket.lines ?? []
  const canReprint = useCanReprintKitchen(lines)
  // The same rules as the bill's own page: an empty bill is anyone's to
  // discard (a room's only once its clock has stopped); with lines on it,
  // only an owner's void, with its reason, takes it off the floor
  const canDiscard = lines.length === 0 && !sending && (ticket.type !== 'Room' || ticket.sessionEndedAt != null)
  const canVoid = !canDiscard && isOwner

  const item = 'h-12 gap-3 px-3 text-base'
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='ghost' size='icon' className='size-12' aria-label={t('moreActions')}>
            <Ellipsis className='size-5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-56'>
          <DropdownMenuItem className={item} disabled={lines.length === 0} onSelect={() => setDiscountOpen(true)}>
            <BadgePercent className='size-5' />
            <span className='flex-1'>{t('discount')}</span>
          </DropdownMenuItem>
          {lines.length > 0 && (
            <DropdownMenuItem className={item} onSelect={() => void printSheets()}>
              <Printer className='size-5' />
              {t('printBill')}
            </DropdownMenuItem>
          )}
          {canReprint && (
            <DropdownMenuItem className={item} onSelect={() => setReprintOpen(true)}>
              <Printer className='size-5' />
              {t('kitchenTickets')}
            </DropdownMenuItem>
          )}
          {/* Picking lines to split, move or name: the order's own list turns into boxes to tick */}
          {lines.length > 0 && (
            <DropdownMenuItem
              className={item}
              onSelect={onSelectLines}
            >
              <ListChecks className='size-5' />
              {t('splitOrMove')}
            </DropdownMenuItem>
          )}
          {/* What was taken in parts, each to give back: an owner's to do, as a void is */}
          {parts.map((p) => (
            <DropdownMenuItem key={String(p.id)} className={item} onSelect={() => setGivingBack(p)}>
              <Undo2 className='size-5' />
              <span className='min-w-0 flex-1 truncate'>
                {t('partGiveBack', { amount: money(p.amount) })}
                {p.payerName ? <bdi> · {p.payerName}</bdi> : null}
              </span>
            </DropdownMenuItem>
          ))}
          {canDiscard ? (
            <DropdownMenuItem variant='destructive' className={item} onSelect={() => setDiscardOpen(true)}>
              <Trash2 className='size-5' />
              {t('discardTicket')}
            </DropdownMenuItem>
          ) : (
            canVoid && (
              <DropdownMenuItem
                variant='destructive'
                className={item}
                onSelect={() => (runningStay ? setVoidGuardOpen(true) : setVoidOpen(true))}
              >
                <Ban className='size-5' />
                {t('voidTicket')}
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DiscountDialog ticket={ticket} open={discountOpen} onOpenChange={setDiscountOpen} />
      <KitchenReprintDialog lines={lines} open={reprintOpen} onOpenChange={setReprintOpen} />
      <DiscardTicketDialog ticketId={ticketId} open={discardOpen} onOpenChange={setDiscardOpen} />
      <VoidTicketDialog ticketId={ticketId} orderIds={orderIdsOn(lines)} open={voidOpen} onOpenChange={setVoidOpen} />
      {/* Time that has not landed yet is money: a void would write it off unseen */}
      <ConfirmDialog
        open={voidGuardOpen}
        onOpenChange={setVoidGuardOpen}
        title={t('voidWithSessionTitle')}
        cancelLabel={t('goBack')}
        actionLabel={t('endSessionButton')}
        destructive
        onAction={() => {
          if (runningStay) stayActions.endStay(toNumber(runningStay.id))
        }}
      />
      <ConfirmDialog
        open={givingBack !== null}
        onOpenChange={(open) => !open && setGivingBack(null)}
        title={t('partGiveBackTitle', { amount: money(givingBack?.amount ?? 0), name: givingBack?.payerName ?? t('guest') })}
        description={t('partGiveBackHint')}
        cancelLabel={t('goBack')}
        actionLabel={t('partGiveBack', { amount: money(givingBack?.amount ?? 0) })}
        destructive
        onAction={() => {
          if (!givingBack) return
          giveBack.mutate({
            path: { id: ticketId, partPaymentId: toNumber(givingBack.id) },
            query: { 'api-version': API_VERSION },
            headers: { 'x-requestid': crypto.randomUUID() },
          })
        }}
      />
      {/* What Print bill puts on paper */}
      {lines.length > 0 && <ReceiptSheet ticket={ticket} unpaid />}
    </>
  )
}
