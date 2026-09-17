import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type BillView } from '@/api/sales'
import { getMyBillsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { type StayViewModel } from '@/api/spaces'
import { API_VERSION } from './api-client'
import { useSelectedBranch } from './branch'
import { businessDayStart } from './business-day'

/** How far back the bills reach. One read, no paging: a regular's three
 *  months of bills is a short list. */
const HISTORY_DAYS = 90
const DAY_MS = 24 * 60 * 60 * 1000

export const isOpen = (bill: BillView) => bill.status === 'Open'
export const isSettled = (bill: BillView) => bill.status === 'Settled'

/** When the till closed the bill, paid or thrown out; null while open. */
export function closedAt(bill: BillView): Date | null {
  const at = bill.settledAt ?? bill.voidedAt
  return at ? new Date(at) : null
}

/**
 * The customer's bills: every Sales ticket they are on — sat in the room,
 * ordered a line, paid a share — open ones whatever their age (last
 * night's unpaid table is still today's) and closed ones for the last
 * three months. Sales knows a guest by the id their browser sends, so a
 * guest reads the same list.
 */
export function useMyBills() {
  const branch = useSelectedBranch()
  // Today = the branch's current business day (overnight shifts included)
  const dayStart = businessDayStart(branch)
  const since = new Date(dayStart.getTime() - HISTORY_DAYS * DAY_MS)
  const query = useQuery({
    ...getMyBillsOptions({
      query: { 'api-version': API_VERSION, since: since.toISOString() },
    }),
    // A friend's round landing on the same bill sends this browser no
    // event, so an open bill is re-read now and then as well
    refetchInterval: (query) =>
      query.state.data?.some(isOpen) ? 30_000 : false,
  })
  return { ...query, dayStart }
}

/** A minute clock: the running time line only needs the minute. */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return now
}

export type RunningTime = {
  /** Minutes on the clock so far */
  minutes: number
  /** One entry per rate the clock ran on, as the till will bill them */
  parts: Array<{
    optionName: StayViewModel['currentOptionName']
    hours: number
    rate: number
    cost: number
  }>
  /** The cost with the bill's discount and VAT on top, since that is what
   *  the total will grow by. No service: room time is not an order. */
  charged: number
}

/**
 * The time a running clock has racked up on an open bill, before the till
 * stops it and it lands as a line. Mirrors Stay.HoursFor: the minutes on
 * each rate, rounded to the tariff's step, times that rate. Only for the
 * stay this customer is in — anyone else's clock is not theirs to see.
 */
export function runningTime(
  bill: BillView,
  stay: StayViewModel | undefined,
  now: number,
): RunningTime | null {
  if (
    !isOpen(bill) ||
    bill.sessionId == null ||
    bill.sessionEndedAt != null ||
    stay == null ||
    Number(stay.id) !== Number(bill.sessionId) ||
    !stay.startedAt
  )
    return null

  const step = Number(stay.tariff?.roundingMinutes ?? 15) || 15
  const byOption = new Map<
    string,
    {
      optionName: StayViewModel['currentOptionName']
      rate: number
      minutes: number
    }
  >()
  for (const segment of stay.segments ?? []) {
    if (!segment.startTime) continue
    const end = segment.endTime ? new Date(segment.endTime).getTime() : now
    const minutes = Math.max(
      0,
      (end - new Date(segment.startTime).getTime()) / 60_000,
    )
    const code = segment.optionCode ?? ''
    const part = byOption.get(code) ?? {
      optionName: segment.optionName,
      rate: Number(segment.hourlyRate ?? 0),
      minutes: 0,
    }
    part.minutes += minutes
    byOption.set(code, part)
  }

  const parts = [...byOption.values()].map((part) => {
    const hours = (Math.round(part.minutes / step) * step) / 60
    return {
      optionName: part.optionName,
      hours,
      rate: part.rate,
      cost: hours * part.rate,
    }
  })
  const minutes = Math.max(
    0,
    (now - new Date(stay.startedAt).getTime()) / 60_000,
  )
  const cost = parts.reduce((sum, part) => sum + part.cost, 0)

  // As the till bills it: the discount thins it, VAT goes on top unless
  // the prices already hold it, and service never touches time
  let charged = cost * (1 - Number(bill.discountRate ?? 0))
  if (!bill.vatIncluded) charged += charged * Number(bill.vatRate ?? 0)

  return { minutes, parts, charged }
}

export const percent = (rate: number | string | null | undefined) =>
  Math.round(Number(rate ?? 0) * 100)

export type Share = {
  /** What the customer's own rounds come to, at menu prices */
  ownLines: number
  /** How many the place's time is split by: the stay's roster */
  members: number
  /** The customer's part of the place's time, split evenly */
  timeShare: number
  /** Their part of the whole bill: rounds and time share, with the
   *  discount, service and VAT in the same proportion */
  share: number
  /** The bill's total, a running clock's time so far included */
  total: number
  /** What the share leaves: everyone else's rounds and time */
  rest: number
  /** A guess rather than the till's word: a clock still running, or a
   *  split the group may settle otherwise */
  approx: boolean
}

/**
 * What of a bill is the customer's. The till says whose each round is;
 * the place's time is nobody's until the group settles it, so it is
 * split evenly across the stay's roster here, marked as about. The bill-
 * level discount, service and VAT follow in proportion.
 */
export function billShare(bill: BillView, running: RunningTime | null): Share {
  const lines = bill.lines ?? []
  const ownLines = lines
    .filter((line) => line.isMine && line.source !== 'SessionTime')
    .reduce((sum, line) => sum + Number(line.total ?? 0), 0)
  const runningCost =
    running?.parts.reduce((sum, part) => sum + part.cost, 0) ?? 0
  const time =
    lines
      .filter((line) => line.source === 'SessionTime')
      .reduce((sum, line) => sum + Number(line.total ?? 0), 0) + runningCost
  const members = Math.max(1, Number(bill.memberCount ?? 0))
  const timeShare = time / members

  // Running time is not on the bill yet, so it goes on both sides of the
  // proportion that carries the discount, service and VAT
  const total = Number(bill.total ?? 0) + (running?.charged ?? 0)
  const base = Number(bill.subtotal ?? 0) + runningCost
  const factor = base > 0 ? total / base : 1
  const share = (ownLines + timeShare) * factor

  return {
    ownLines,
    members,
    timeShare,
    share,
    total,
    rest: Math.max(0, total - share),
    approx: running != null || (members > 1 && time > 0),
  }
}
