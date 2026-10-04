import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

/**
 * The order being followed: after Place order, the order that was just sent
 * shows on the dock beside the bill (sent, then confirmed by the till, or
 * turned down) until it is done with. The customer app says only what the
 * till has said: that it has the order, and that it confirmed it. Whether
 * the kitchen has finished it is not the customer's to be told, since not
 * every business has a kitchen screen to say so. A delivery is followed to
 * the door: being made, on its way with its rider, delivered, since the
 * rider says each one. This file is the pure logic
 * (which order, what it says, when it goes) and the little store that
 * remembers there is an order to follow.
 */

export type PillStage = 'sent' | 'confirmed' | 'preparing' | 'onTheWay' | 'delivered' | 'notDelivered' | 'paid' | 'cancelled'

/** What the pill needs from an order (the Ordering OrderSummary shape) */
export type PillOrder = {
  orderNumber?: number | string
  date?: string
  status?: string
  paidAt?: string | null
  voidedAt?: string | null
  /** The business's own delivery, where it has got to and who took it; none for an order eaten in or collected */
  delivery?: { stage?: string; riderName?: string | null } | null
}

/** How far back of the tap an order may be dated: the server's clock is not the phone's */
export const CLOCK_SLACK_MS = 2 * 60_000
/** The pill follows one order for this long at most */
export const FOLLOW_FOR_MS = 45 * 60_000
/** A delivery is followed to the door, for this long at most */
export const FOLLOW_DELIVERY_FOR_MS = 2 * 60 * 60_000
/** The order should be in the list by now; if not, the pill lets go */
export const NOT_FOUND_AFTER_MS = 2 * 60_000

/** How long each end state stays on screen once reached */
export const LINGER_MS: Record<PillStage, number | null> = {
  sent: null,
  // Confirmed, the round is on the bill: the dock says so for a moment, then the row is the bill again
  confirmed: 8_000,
  // A delivery stays on the dock while it is made and on its way, and says it arrived for a moment
  preparing: null,
  onTheWay: null,
  delivered: 10_000,
  // The rider couldn't find the door, or nobody answered: said, and held long enough to be read
  notDelivered: 30_000,
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
  // A delivery is paid at the door, so it is delivered before it is paid: the door is the news
  if (order.delivery && status === 'confirmed') {
    const stage = order.delivery.stage
    if (stage === 'Delivered') return 'delivered'
    if (stage === 'Failed' || stage === 'Returned') return 'notDelivered'
    if (stage === 'OnTheWay') return 'onTheWay'
    return 'preparing'
  }
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
  if (now - placedAt > followFor(order)) return false
  if (!order) return now - placedAt < NOT_FOUND_AFTER_MS
  const linger = LINGER_MS[stageOf(order)]
  return linger == null || now - stageSince < linger
}

function followFor(order: PillOrder | null): number {
  return order?.delivery ? FOLLOW_DELIVERY_FOR_MS : FOLLOW_FOR_MS
}

/** The next moment the answer of pillVisible can change, for a timer */
export function nextCheck(v: PillVisibility): number | null {
  if (v.dismissed) return null
  const times = [v.placedAt + followFor(v.order)]
  if (!v.order) times.push(v.placedAt + NOT_FOUND_AFTER_MS)
  else {
    const linger = LINGER_MS[stageOf(v.order)]
    if (linger != null) times.push(v.stageSince + linger)
  }
  const next = Math.min(...times.filter((t) => t > v.now))
  return Number.isFinite(next) ? next : null
}

/** Icon for a stage, by lucide name, resolved by the component */
export const STAGE_ICON: Record<PillStage, 'send' | 'check' | 'chef' | 'bike' | 'home' | 'receipt' | 'x'> = {
  sent: 'send',
  confirmed: 'check',
  preparing: 'chef',
  onTheWay: 'bike',
  delivered: 'home',
  notDelivered: 'x',
  paid: 'receipt',
  cancelled: 'x',
}

type Words = { en: string; ar: string; arStandard: string }

/** The pill's words; kept here rather than in the app dictionary */
export const STAGE_LABEL: Record<PillStage, Words> = {
  sent: { en: 'Sent', ar: 'اتبعت', arStandard: 'أُرسل' },
  confirmed: { en: 'Confirmed', ar: 'اتأكد', arStandard: 'تم التأكيد' },
  preparing: { en: 'Being made', ar: 'بيتجهز', arStandard: 'قيد التحضير' },
  onTheWay: { en: 'On its way', ar: 'في الطريق', arStandard: 'في الطريق' },
  delivered: { en: 'Delivered', ar: 'وصل', arStandard: 'تم التوصيل' },
  notDelivered: { en: "Couldn't be delivered", ar: 'موصلش', arStandard: 'تعذّر التوصيل' },
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
  preparingNote: {
    en: 'Confirmed. {name} is making it for delivery.',
    ar: 'اتأكد و{name} بيجهزه للتوصيل.',
    arStandard: 'تم التأكيد ويُحضّره {name} للتوصيل.',
  },
  onTheWayNote: {
    en: 'On its way to you. Pay the rider at the door.',
    ar: 'في الطريق ليك. ادفع للمندوب عند الباب.',
    arStandard: 'في الطريق إليك. ادفع للمندوب عند الباب.',
  },
  /** The same, when the till said who took it: `{rider}` is their name */
  onTheWayRiderNote: {
    en: '{rider} is on the way to you. Pay them at the door.',
    ar: '{rider} في الطريق ليك. ادفع له عند الباب.',
    arStandard: '{rider} في الطريق إليك. ادفع له عند الباب.',
  },
  deliveredNote: { en: 'Delivered. Enjoy!', ar: 'وصل. بالهنا والشفا!', arStandard: 'تم التوصيل. بالهناء والشفاء!' },
  notDeliveredNote: {
    en: "The rider couldn't deliver it. {name} will be in touch.",
    ar: 'المندوب مقدرش يوصّله. {name} هيكلمك.',
    arStandard: 'لم يتمكن المندوب من توصيله. سيتواصل معك {name}.',
  },
  cancelledNote: {
    en: '{name} could not take this order.',
    ar: '{name} مقدرش ياخد الطلب ده.',
    arStandard: 'لم يتمكن {name} من قبول هذا الطلب.',
  },
} satisfies Record<string, Words>

/** What a stage says under its title: on its way, it names the rider when the till said who */
export function noteFor(stage: PillStage, order: PillOrder | null, notes: Record<PillStage, Words>): { words: Words; rider: string | null } {
  const rider = order?.delivery?.riderName?.trim() || null
  if (stage === 'notDelivered') return { words: PILL_WORDS.notDeliveredNote, rider: null }
  return stage === 'onTheWay' && rider ? { words: PILL_WORDS.onTheWayRiderNote, rider } : { words: notes[stage], rider: null }
}

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
