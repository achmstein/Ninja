import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * The live status pill: after Place order, the order that was just sent
 * follows the customer around the app as a small pill at the top — sent,
 * being prepared, ready — until it is done with. This file is the pill's
 * pure logic (which order, what it says, when it goes) and the little
 * store that remembers there is an order to follow.
 */

export type PillStage = 'sent' | 'preparing' | 'ready' | 'paid' | 'cancelled'

/** What the pill needs from an order (the Ordering OrderSummary shape) */
export type PillOrder = {
  orderNumber?: number | string
  date?: string
  status?: string
  paidAt?: string | null
  voidedAt?: string | null
  /** Not sent to customers today; honoured if Ordering ever sends it */
  readyAt?: string | null
}

/** How far back of the tap an order may be dated: the server's clock is not the phone's */
export const CLOCK_SLACK_MS = 2 * 60_000
/** The pill follows one order for this long at most */
export const FOLLOW_FOR_MS = 45 * 60_000
/** The order should be in the list by now; if not, the pill lets go */
export const NOT_FOUND_AFTER_MS = 2 * 60_000

/** How long each end state stays on screen once reached */
export const LINGER_MS: Record<PillStage, number | null> = {
  sent: null,
  preparing: 20 * 60_000,
  ready: 90_000,
  paid: 4_000,
  cancelled: 8_000,
}

function time(value: string | null | undefined): number | null {
  if (!value) return null
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

/** Where an order is, as the customer would say it */
export function stageOf(order: PillOrder): PillStage {
  const status = order.status?.toLowerCase()
  if (status === 'cancelled' || order.voidedAt) return 'cancelled'
  if (order.paidAt) return 'paid'
  if (order.readyAt) return 'ready'
  if (status === 'confirmed') return 'preparing'
  // AwaitingValidation / Submitted: with the café, not yet taken on
  return 'sent'
}

/**
 * The order the pill follows: the newest one placed at or after the tap
 * (give or take the clock slack). Null while the list has not caught up.
 */
export function pickOrder<T extends PillOrder>(
  orders: readonly T[],
  placedAt: number,
): T | null {
  let best: T | null = null
  let bestTime = -Infinity
  for (const order of orders) {
    const at = time(order.date)
    if (at == null || at < placedAt - CLOCK_SLACK_MS) continue
    if (at > bestTime) {
      best = order
      bestTime = at
    }
  }
  return best
}

export type PillVisibility = {
  /** When Place order landed */
  placedAt: number
  /** The order, once the list has it */
  order: PillOrder | null
  /** When this stage was first seen */
  stageSince: number
  dismissed: boolean
  now: number
}

/** Whether the pill is still worth showing */
export function pillVisible({
  placedAt,
  order,
  stageSince,
  dismissed,
  now,
}: PillVisibility): boolean {
  if (dismissed) return false
  if (now - placedAt > FOLLOW_FOR_MS) return false
  if (!order) return now - placedAt < NOT_FOUND_AFTER_MS
  const linger = LINGER_MS[stageOf(order)]
  return linger == null || now - stageSince < linger
}

/** The next moment the answer of pillVisible can change, for a timer */
export function nextCheck(v: PillVisibility): number | null {
  if (v.dismissed) return null
  const times = [v.placedAt + FOLLOW_FOR_MS]
  if (!v.order) times.push(v.placedAt + NOT_FOUND_AFTER_MS)
  else {
    const linger = LINGER_MS[stageOf(v.order)]
    if (linger != null) times.push(v.stageSince + linger)
  }
  const next = Math.min(...times.filter((t) => t > v.now))
  return Number.isFinite(next) ? next : null
}

/** Icon for a stage, by lucide name, resolved by the component */
export const STAGE_ICON: Record<PillStage, 'send' | 'flame' | 'bell' | 'check' | 'x'> = {
  sent: 'send',
  preparing: 'flame',
  ready: 'bell',
  paid: 'check',
  cancelled: 'x',
}

type Words = { en: string; ar: string; arStandard: string }

/** The pill's words; kept here rather than in the app dictionary */
export const STAGE_LABEL: Record<PillStage, Words> = {
  sent: { en: 'Sent', ar: 'اتبعت', arStandard: 'أُرسل' },
  preparing: { en: 'Preparing', ar: 'بيتحضر', arStandard: 'قيد التحضير' },
  ready: { en: 'Ready', ar: 'جاهز', arStandard: 'جاهز' },
  paid: { en: 'Paid', ar: 'اتدفع', arStandard: 'مدفوع' },
  cancelled: { en: 'Cancelled', ar: 'اتلغى', arStandard: 'أُلغي' },
}

export const PILL_WORDS = {
  order: { en: 'Order', ar: 'طلب', arStandard: 'طلب' },
  seeBills: { en: 'See your bill', ar: 'شوف الحساب', arStandard: 'اعرض الفاتورة' },
  hide: { en: 'Hide', ar: 'اخفي', arStandard: 'إخفاء' },
  sentNote: {
    en: 'The café has it. It will be confirmed in a moment.',
    ar: 'الطلب وصل للكافيه وهيتأكد حالًا.',
    arStandard: 'وصل الطلب إلى المقهى وسيُؤكَّد بعد قليل.',
  },
  preparingNote: {
    en: 'Confirmed. The kitchen is on it.',
    ar: 'اتأكد والمطبخ شغال عليه.',
    arStandard: 'تم التأكيد والمطبخ يُحضّره.',
  },
  readyNote: { en: 'It is ready.', ar: 'طلبك جاهز.', arStandard: 'طلبك جاهز.' },
  paidNote: { en: 'Paid. Thank you.', ar: 'اتدفع. شكرًا.', arStandard: 'تم الدفع. شكرًا لك.' },
  cancelledNote: {
    en: 'The café could not take this order.',
    ar: 'الكافيه مقدرش ياخد الطلب ده.',
    arStandard: 'لم يتمكن المقهى من قبول هذا الطلب.',
  },
} satisfies Record<string, Words>

export function words(w: Words, language: 'en' | 'ar', standard: boolean): string {
  return language === 'en' ? w.en : standard ? w.arStandard : w.ar
}

type PillState = {
  /** When the last order from this browser was placed; null when none is followed */
  placedAt: number | null
  dismissed: boolean
  /** The order number on show, so the hub does not toast what the pill says */
  shownOrder: number | null
  /** The pill is on screen, so a bar that shares the top with it can make room */
  onScreen: boolean
  follow: (at?: number) => void
  dismiss: () => void
  setShown: (orderNumber: number | null, onScreen?: boolean) => void
}

export const useOrderPill = create<PillState>()(
  persist(
    (set) => ({
      placedAt: null,
      dismissed: false,
      shownOrder: null,
      onScreen: false,
      follow: (at = Date.now()) => set({ placedAt: at, dismissed: false, shownOrder: null }),
      dismiss: () => set({ dismissed: true, shownOrder: null }),
      setShown: (orderNumber, onScreen = orderNumber != null) => set({ shownOrder: orderNumber, onScreen }),
    }),
    {
      name: 'ninja-order-pill',
      // One tab's order: a new tab starts clean
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ placedAt: s.placedAt, dismissed: s.dismissed }),
    },
  ),
)

/** The pill already says this order's news: no toast for it */
export function pillShowsOrder(orderId: number): boolean {
  return orderId > 0 && useOrderPill.getState().shownOrder === orderId
}
