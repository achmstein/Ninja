import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TicketDetail, TicketLineView } from '@/api/sales'
import { refundTicketMutation } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { toast } from '@/lib/toast'
import { ACCOUNT_TENDER, BASE_TENDERS } from './tenders'

export type RefundHolder = { id: string; name: string }

/** A line that can still come back: what is left of it, and how much of that is picked */
export type RefundEntry = { line: TicketLineView; id: number; left: number; picked: number }

/**
 * A credit note against a settled ticket, as it is being made: which lines
 * come back and how many of each, why, and where the money goes. Lines are
 * picked by quantity (what is left of each after earlier credit notes) and
 * each gives back what the customer paid for it, service and VAT included;
 * the preview mirrors the server's arithmetic, the server's answer is the one
 * printed. Cash comes out of the drawer; a tab that paid can be credited
 * instead. The reason is mandatory: it is the audit trail.
 *
 * One making for wherever a refund is made from: the bill's own pop-up, and
 * the receipts page, where it is made beside the list.
 */
export function useRefund(ticket: TicketDetail, onDone: () => void) {
  const t = useT()
  const money = useMoney()
  const queryClient = useQueryClient()
  const features = useFeatures()

  const [qtyByLine, setQtyByLine] = useState<Record<number, number>>({})
  const [reason, setReason] = useState('')
  const [tender, setTender] = useState<'Cash' | 'Account'>('Cash')
  const [holderId, setHolderId] = useState<string | null>(null)

  const reset = () => {
    setQtyByLine({})
    setReason('')
    setTender('Cash')
    setHolderId(null)
  }

  // What earlier credit notes already took, per line
  const refundedQty = useMemo(() => {
    const map = new Map<number, number>()
    for (const refund of ticket.refunds ?? []) {
      for (const line of refund.lines ?? []) {
        const id = toNumber(line.ticketLineId)
        map.set(id, (map.get(id) ?? 0) + toNumber(line.qty))
      }
    }
    return map
  }, [ticket.refunds])

  // Discount lines cannot come back on their own; everything else can, up
  // to what is left of it
  const lines: RefundEntry[] = (ticket.lines ?? [])
    .filter((line) => toNumber(line.total) > 0)
    .map((line) => {
      const id = toNumber(line.id)
      const left = toNumber(line.qty) - (refundedQty.get(id) ?? 0)
      return { line, id, left: Math.max(0, left), picked: qtyByLine[id] ?? 0 }
    })
    .filter((entry) => entry.left > 0)

  const total = toNumber(ticket.total)
  const subtotal = toNumber(ticket.subtotal)
  const refundedSoFar = toNumber(ticket.refundedTotal)
  const remainder = Math.max(0, total - refundedSoFar)
  const paidPerMenuPound = subtotal > 0 ? total / subtotal : 1

  const everythingPicked = lines.length > 0 && lines.every((entry) => entry.picked >= entry.left)
  const preview = everythingPicked
    ? remainder
    : lines.reduce((sum, entry) => {
        if (entry.picked <= 0) return sum
        const menu = (toNumber(entry.line.total) * entry.picked) / toNumber(entry.line.qty)
        return sum + Math.round(menu * paidPerMenuPound * 100) / 100
      }, 0)

  // Tabs that paid this ticket are the only ones a refund can go back onto
  const holders: RefundHolder[] = []
  for (const payment of ticket.payments ?? []) {
    if (payment.tender === ACCOUNT_TENDER.name && payment.customerId) {
      const id = String(payment.customerId)
      if (!holders.some((h) => h.id === id)) holders.push({ id, name: payment.customerName ?? '' })
    }
  }
  const holder = holders.find((h) => h.id === holderId) ?? holders[0]
  // Back to a tab only where the business runs tabs, or a tab paid this bill (it can still be paid back)
  const offerAccount = features.tabs || holders.length > 0

  const refund = useMutation({
    ...refundTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getTicket' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getCurrentShift' }] })
      // The receipts list says what went back on each
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getSettledTicketsInfinite' }] })
      toast.success(t('ticketRefunded', { number: toNumber(result.number), amount: money(result.amount) }))
      reset()
      onDone()
    },
  })

  /** A line's count, a whole one at a time, or a quarter for one that is not whole (a room's hours) */
  const step = (entry: RefundEntry, by: 1 | -1) =>
    setQtyByLine((prev) => {
      const unit = Number.isInteger(entry.left) && Number.isInteger(toNumber(entry.line.qty)) ? 1 : 0.25
      const next = Math.round(((prev[entry.id] ?? 0) + unit * by) * 100) / 100
      return { ...prev, [entry.id]: Math.max(0, Math.min(entry.left, next)) }
    })

  /** A line ticked or unticked, as lines are picked on an order: ticked, all that is left of it comes back */
  const toggle = (entry: RefundEntry) =>
    setQtyByLine((prev) => ({ ...prev, [entry.id]: (prev[entry.id] ?? 0) > 0 ? 0 : entry.left }))

  const pickEverything = () => setQtyByLine(Object.fromEntries(lines.map((entry) => [entry.id, entry.left])))

  const canRefund =
    preview > 0 && reason.trim().length > 0 && (tender === 'Cash' || holder != null) && !refund.isPending

  const submit = () =>
    refund.mutate({
      // A retry on business Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      path: { id: toNumber(ticket.id) },
      query: { 'api-version': API_VERSION },
      body: {
        lines: lines.filter((entry) => entry.picked > 0).map((entry) => ({ lineId: entry.id, qty: entry.picked })),
        reason: reason.trim(),
        tender: tender === 'Account' ? ACCOUNT_TENDER.value : BASE_TENDERS[0].value,
        customerId: tender === 'Account' ? holder?.id : null,
        customerName: tender === 'Account' ? holder?.name : null,
      },
    })

  return {
    lines,
    remainder,
    preview,
    everythingPicked,
    step,
    toggle,
    pickEverything,
    reason,
    setReason,
    tender,
    setTender,
    holders,
    holder,
    setHolderId,
    offerAccount,
    canRefund,
    pending: refund.isPending,
    submit,
    reset,
  }
}
