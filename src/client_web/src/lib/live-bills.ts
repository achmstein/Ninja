import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type OrderSummary } from '@/api/ordering'
import { getOrdersByUserOptions } from '@/api/ordering/@tanstack/react-query.gen'
import { type BillView } from '@/api/sales'
import { API_VERSION } from '@/lib/api-client'
import { closedAt, isOpen, useMyBills, useNow } from '@/lib/bills'

/** A round sent but not on its bill yet: the till has still to confirm it, or has and the bill is catching up */
export type PendingStage = 'waiting' | 'adding'

/** An order of the customer's on its way to a bill */
export type PendingRound = { orderId: number; date: string | null | undefined; stage: PendingStage }

/** The id of a bill the till has not opened yet: the card a first round waits on */
export const FORMING_BILL = 'forming'

/** How long a round turned down stays in sight, ms */
const TURNED_DOWN_MS = 30 * 60_000

/**
 * The customer's bills as the app shows them, read once for the dock's
 * live bill and the bills history alike:
 * - `open`: the bills open now, each with the rounds on their way to it;
 * - `forming`: a bill the till has not opened yet, made of the first rounds
 *   on their way, named after where they were sent and adding up to them;
 * - `closed`: the paid and voided ones, today's first, then back three months;
 * - `turnedDown`: rounds the till turned down in the last half hour.
 * An order still on its way is already on its bill as a round, and the
 * bill re-reads itself every two seconds while the till has confirmed an
 * order that Sales has not put on it yet.
 */
export function useLiveBills() {
  // Open bills whatever their age (last night's unpaid table is still today's) and closed ones back to the history
  const billsQuery = useMyBills()
  const { dayStart } = billsQuery
  const bills = billsQuery.data ?? []
  const today = bills.filter((bill) => {
    const closed = closedAt(bill)
    return closed == null || closed >= dayStart
  })
  const before = bills.filter((bill) => {
    const closed = closedAt(bill)
    return closed != null && closed < dayStart
  })

  // The orders are read for what is not on a bill yet (sent and waiting, or turned down) and for the stars on each
  const ordersQuery = useQuery(
    getOrdersByUserOptions({
      query: { 'api-version': API_VERSION, pageIndex: 0, pageSize: 50, fromDate: dayStart.toISOString() },
    })
  )
  const orders = ordersQuery.data?.items ?? []
  const status = (order: OrderSummary) => order.status?.toLowerCase()
  const waiting = orders.filter((order) => status(order) !== 'confirmed' && status(order) !== 'cancelled')
  // Confirmed, but Sales has not put it on a bill yet: it does so off its own copy of the event,
  // a moment after this page hears the order was confirmed
  const onBills = new Set(bills.flatMap((bill) => (bill.lines ?? []).map((line) => Number(line.orderId ?? 0))))
  const adding = orders.filter((order) => status(order) === 'confirmed' && !onBills.has(Number(order.orderNumber)))
  const catchingUp = adding.length > 0
  const refetchBills = billsQuery.refetch
  useEffect(() => {
    if (!catchingUp) return
    const timer = setInterval(() => void refetchBills(), 2000)
    return () => clearInterval(timer)
  }, [catchingUp, refetchBills])

  const now = useNow()
  const turnedDown = orders.filter(
    (order) => status(order) === 'cancelled' && order.date && now - new Date(order.date).getTime() < TURNED_DOWN_MS
  )
  const open = today.filter(isOpen)
  const { byBill, forming } = placeRounds(open, waiting, adding)

  return {
    loading: billsQuery.isLoading || ordersQuery.isLoading,
    failed: billsQuery.isError && ordersQuery.isError,
    retry: () => {
      void billsQuery.refetch()
      void ordersQuery.refetch()
    },
    open: open.map((bill) => ({ bill, pending: byBill.get(String(bill.id)) ?? [] })),
    forming,
    closed: [...today.filter((bill) => !isOpen(bill)), ...before],
    turnedDown,
    ordersById: new Map(orders.map((order) => [Number(order.orderNumber), order])),
  }
}

export type LiveBills = ReturnType<typeof useLiveBills>

/**
 * The rounds on their way, each put with the open bill it will land on: the
 * one at the same place, else the first open one. With no open bill at all
 * they wait on a bill of their own the till has not opened yet.
 */
function placeRounds(open: BillView[], waiting: OrderSummary[], adding: OrderSummary[]) {
  const byBill = new Map<string, PendingRound[]>()
  const orphans: Array<{ round: PendingRound; order: OrderSummary }> = []
  const all = [
    ...waiting.map((order) => ({ order, stage: 'waiting' as const })),
    ...adding.map((order) => ({ order, stage: 'adding' as const })),
  ].sort((x, y) => new Date(y.order.date ?? 0).getTime() - new Date(x.order.date ?? 0).getTime())
  for (const { order, stage } of all) {
    const round: PendingRound = { orderId: Number(order.orderNumber), date: order.date, stage }
    const bill = open.find((b) => b.placeId != null && String(b.placeId) === String(order.placeId)) ?? open[0]
    if (bill) byBill.set(String(bill.id), [...(byBill.get(String(bill.id)) ?? []), round])
    else orphans.push({ round, order })
  }
  if (orphans.length === 0) return { byBill, forming: null }
  const first = orphans[0].order
  const bill: BillView = {
    id: FORMING_BILL,
    status: 'Open',
    placeId: first.placeId,
    placeKind: first.placeKind,
    locationName: first.placeName,
    lines: [],
    total: orphans.reduce((sum, o) => sum + Number(o.order.total ?? 0) - Number(o.order.loyaltyDiscount ?? 0), 0),
  }
  return { byBill, forming: { bill, rounds: orphans.map((o) => o.round) } }
}
