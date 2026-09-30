import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * The order being followed: after Place order, the order that was just sent
 * shows on the dock beside the bill (sent, then confirmed by the till, or
 * turned down) until it is done with. The customer app says only what the
 * till has said: that it has the order, and that it confirmed it. Whether
 * the kitchen has finished it is not the customer's to be told, since not
 * every business has a kitchen screen to say so. This file is the pure logic
 * (which order, what it says, when it goes) and the little store that
 * remembers there is an order to follow.
 */

export type PillStage = 'sent' | 'confirmed' | 'paid' | 'cancelled'

/** What the pill needs from an order (the Ordering OrderSummary shape) */
export type PillOrder = {
  orderNumber?: number | string
  date?: string
  status?: string
  paidAt?: string | null
  voidedAt?: string | null
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
  // Confirmed, the round is on the bill: the dock says so for a moment, then the row is the bill again
  confirmed: 8_000,
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
  if (status === 'confirmed') return 'confirmed'
  // AwaitingValidation / Submitted: with the business, not yet taken on
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
export const STAGE_ICON: Record<PillStage, 'send' | 'check' | 'receipt' | 'x'> = {
  sent: 'send',
  confirmed: 'check',
  paid: 'receipt',
  cancelled: 'x',
}

type Words = { en: string; ar: string; arStandard: string }

/** The pill's words; kept here rather than in the app dictionary */
export const STAGE_LABEL: Record<PillStage, Words> = {
  sent: { en: 'Sent', ar: 'اتبعت', arStandard: 'أُرسل' },
  confirmed: { en: 'Confirmed', ar: 'اتأكد', arStandard: 'تم التأكيد' },
  paid: { en: 'Paid', ar: 'اتدفع', arStandard: 'مدفوع' },
  cancelled: { en: 'Cancelled', ar: 'اتلغى', arStandard: 'أُلغي' },
}

export const PILL_WORDS = {
  order: { en: 'Order', ar: 'طلب', arStandard: 'طلب' },
  seeBills: { en: 'See your bill', ar: 'شوف الحساب', arStandard: 'اعرض الفاتورة' },
  hide: { en: 'Hide', ar: 'اخفي', arStandard: 'إخفاء' },
  sentNote: {
    en: '{name} has it. It will be confirmed in a moment.',
    ar: 'الطلب وصل لـ{name} وهيتأكد حالًا.',
    arStandard: 'وصل الطلب إلى {name} وسيُؤكَّد بعد قليل.',
  },
  confirmedNote: {
    en: 'Confirmed. It is on your bill.',
    ar: 'اتأكد وبقى على حسابك.',
    arStandard: 'تم التأكيد وأُضيف إلى فاتورتك.',
  },
  paidNote: { en: 'Paid. Thank you.', ar: 'اتدفع. شكرًا.', arStandard: 'تم الدفع. شكرًا لك.' },
  cancelledNote: {
    en: '{name} could not take this order.',
    ar: '{name} مقدرش ياخد الطلب ده.',
    arStandard: 'لم يتمكن {name} من قبول هذا الطلب.',
  },
} satisfies Record<string, Words>

/** The words in the language asked; a `{name}` in them is the business's name */
export function words(w: Words, language: 'en' | 'ar', standard: boolean, name = ''): string {
  return (language === 'en' ? w.en : standard ? w.arStandard : w.ar).replaceAll('{name}', name)
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
