import { useEffect, useState } from 'react'
import type { TicketDetail } from '@/api/sales/types.gen'
import { printSheets, takesCash } from '@/features/printing/print-sheets'
import { KitchenChitSheet } from '@/features/receipt/kitchen-chit-sheet'
import { ReceiptSheet } from '@/features/receipt/receipt-sheet'
import { saleTotal, type SaleLine } from '@/features/sale/cart'
import { SettleDialog } from '@/features/ticket/settle-dialog'
import { lastOpenShiftId } from '@/features/shift/last-open-shift'
import { getActiveBranchId } from '@/stores/branch-store'
import {
  enqueueOfflineSale,
  nextProvisionalReceiptNumber,
} from './offline-queue'
import type { OfflinePayment, OfflineSale } from './offline-replay'
import { counterBill, NO_PRICING } from './pricing'
import { useBranchPricing } from './use-branch-pricing'

/** What the sale pad knows about a counter sale before any money is taken */
export type OfflineSaleDraft = {
  /** The order's idempotency key: the one an online attempt at it already used, if any */
  requestId: string
  lines: SaleLine[]
  note: string
  customerName: string | null
  /** Empties the sale pad once the money is taken and the sale is queued */
  onQueued: () => void
}

type Charging = {
  draft: OfflineSaleDraft
  placedAt: string
  ticket: TicketDetail
}

const optionsText = (line: SaleLine, language: 'en' | 'ar') =>
  line.customizations
    .map((c) =>
      language === 'ar' ? c.optionNameAr || c.optionNameEn : c.optionNameEn,
    )
    .filter(Boolean)
    .join(', ')

/**
 * Takes the money for a counter sale while the server is out of reach, the
 * way the Flutter till does (sale_pad_screen.dart `_chargeOffline`): the
 * pad prices the sale as Sales will when it is replayed (a counter sale has
 * no service charge; VAT follows the branch's kept rules), the usual settle
 * dialog takes cash, card or InstaPay, and the paid sale is queued with a
 * provisional number. The receipt and a kitchen chit print together, since
 * no kitchen ticket can come from the server.
 */
export function useOfflineCharge() {
  const pricing = useBranchPricing() ?? NO_PRICING
  const [charging, setCharging] = useState<Charging | null>(null)
  const [queued, setQueued] = useState<OfflineSale | null>(null)

  const start = (draft: OfflineSaleDraft) => {
    const bill = counterBill(saleTotal(draft.lines), pricing)
    const placedAt = new Date().toISOString()
    setQueued(null)
    setCharging({
      draft,
      placedAt,
      ticket: {
        id: 0,
        type: 'Counter',
        status: 'Open',
        label: draft.customerName,
        openedAt: placedAt,
        settledAt: placedAt,
        subtotal: bill.subtotal,
        vat: bill.vat,
        vatRate: pricing.vatRate,
        vatIncluded: pricing.pricesIncludeVat,
        serviceCharge: 0,
        total: bill.total,
        lines: draft.lines.map((line, index) => ({
          id: index + 1,
          description: { en: line.nameEn || null, ar: line.nameAr || null },
          details: line.customizations.length
            ? { en: optionsText(line, 'en'), ar: optionsText(line, 'ar') }
            : null,
          qty: line.quantity,
          unitPrice: line.price,
          total: line.price * line.quantity,
          customerName: draft.customerName,
        })),
      },
    })
  }

  const settle = async (payments: OfflinePayment[], change: number) => {
    if (!charging) throw new Error('Nothing is being charged')
    const { draft, placedAt, ticket } = charging
    const branchId = getActiveBranchId()
    const sale: OfflineSale = {
      id: draft.requestId,
      settleRequestId: crypto.randomUUID(),
      placedAt,
      branchId,
      // The drawer it was paid into, so the replay credits that shift
      shiftId: lastOpenShiftId(branchId),
      provisionalReceiptNumber: nextProvisionalReceiptNumber(),
      lines: draft.lines,
      note: draft.note,
      customerName: draft.customerName,
      payments,
      subtotal: Number(ticket.subtotal),
      vat: Number(ticket.vat),
      vatRate: Number(ticket.vatRate),
      vatIncluded: ticket.vatIncluded === true,
      total: Number(ticket.total),
      change,
      status: 'queued',
      error: null,
      orderId: null,
      ticketId: null,
    }
    await enqueueOfflineSale(sale)
    // Paid and queued: the pad must never offer it for a second charge
    draft.onQueued()
    setQueued(sale)
    return sale.provisionalReceiptNumber
  }

  // The receipt for the customer and the chit for the kitchen, in one go,
  // once both sheets are on the page; cash opens the drawer with them
  useEffect(() => {
    if (queued) void printSheets({ kickDrawer: takesCash(queued.payments) })
  }, [queued])

  // Back to an empty pad for the next customer: the floor has nothing to
  // show while the server is out of reach
  const close = (open: boolean) => {
    if (open) return
    setCharging(null)
    setQueued(null)
  }

  const element = charging ? (
    <>
      <SettleDialog
        ticket={charging.ticket}
        open
        onOpenChange={close}
        offline={{ settle }}
      />
      {queued && (
        <>
          <ReceiptSheet
            ticket={charging.ticket}
            paymentsOverride={queued.payments.map((p) => ({
              tender: p.tenderName,
              amount: p.amount,
            }))}
            provisionalNumber={queued.provisionalReceiptNumber}
          />
          <KitchenChitSheet sale={queued} />
        </>
      )}
    </>
  ) : null

  return { start, element }
}
