import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { formatMoney, useCurrency } from '@/lib/currency'
import {
  useLanguage,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { formatWhen } from '@/lib/when'
import { urgencyFor, type Urgency } from '@/components/queue-card'

export { urgencyTextClass } from '@/components/queue-card'

type OrderStatusValue = 'submitted' | 'confirmed' | 'cancelled'

export const orderStatuses: {
  value: OrderStatusValue
  key: TranslationKey
  /** A soft chip: waiting is amber, confirmed green, cancelled red */
  variant: 'warning' | 'success' | 'danger'
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'submitted', key: 'pendingStatus', variant: 'warning', icon: Clock },
  {
    value: 'confirmed',
    key: 'confirmed',
    variant: 'success',
    icon: CheckCircle,
  },
  {
    value: 'cancelled',
    key: 'cancelled',
    variant: 'danger',
    icon: XCircle,
  },
]

// The API reports enum names ("Submitted"); compare case-insensitively.
export function getOrderStatus(status: string | undefined | null) {
  return orderStatuses.find((s) => s.value === status?.toLowerCase())
}

export function isSubmitted(status: string | undefined | null): boolean {
  return status?.toLowerCase() === 'submitted'
}

export function isCancelled(status: string | undefined | null): boolean {
  return status?.toLowerCase() === 'cancelled'
}

// OrderSource enum names from Ordering.Domain
export const orderSourceKeys: Record<string, TranslationKey> = {
  Customer: 'sourceCustomer',
  Guest: 'sourceGuest',
  Pos: 'sourcePos',
  Talabat: 'sourceTalabat',
}

/**
 * Why staff turn a delivery platform's order down, as the platform spells
 * it; the platform tells its customer. Too busy is the answer when nothing
 * else fits.
 */
export const platformRejectReasons: { value: string; key: TranslationKey }[] = [
  { value: 'TOO_BUSY', key: 'rejectTooBusy' },
  { value: 'ITEM_UNAVAILABLE', key: 'rejectItemUnavailable' },
  { value: 'CLOSED', key: 'rejectClosed' },
  { value: 'NO_COURIER', key: 'rejectNoCourier' },
  { value: 'OUTSIDE_DELIVERY_AREA', key: 'rejectOutsideArea' },
  { value: 'FRAUD_PRANK', key: 'rejectPrank' },
]

export const defaultPlatformRejectReason = platformRejectReasons[0].value

// Where an order was placed from, for grouping the live board
export type OrderPlace = 'rooms' | 'tables' | 'counter' | 'delivery'

/** The board's lane: plain tables, everything timed (rooms, stations),
 *  the branch's own deliveries, or the counter for an order with no place
 *  at all. */
export function orderPlace(order: {
  placeId?: number | string | null
  placeKind?: string | null
  delivery?: unknown
}): OrderPlace {
  if (order.delivery) return 'delivery'
  if (order.placeKind === 'Table') return 'tables'
  if (order.placeId != null) return 'rooms'
  return 'counter'
}

// Localized currency suffix (EGP / ج.م). Callers all live inside components
// that re-render on language change, so reading the store here stays fresh.
/** A price in the business's currency: `12.50 EGP` / `12.50 ج.م`. */
export function formatEgp(
  value: number | string | undefined | null,
  signed = false
): string {
  return formatMoney(
    value,
    useCurrency.getState().code,
    useLanguage.getState().language,
    signed
  )
}

/** How long ago, said the admin's one way (lib/when.ts): "5m ago", "Yesterday 14:32", "Fri 3 Oct" */
export function relativeTime(
  value: string | undefined,
  nowMs: number,
  t: (key: TranslationKey, params?: TranslateParams) => string,
  locale: string
): string {
  if (!value) return ''
  return formatWhen(value, 'relative', locale, t, new Date(nowMs))
}

// KDS-style aging, matched to the backend reminder escalation (drinks move
// fast here): amber after 2 minutes, red once it's the 3-minute order the
// reminders are already ringing about
export const WARN_AFTER_MINUTES = 2
export const DELAYED_AFTER_MINUTES = 3

type OrderUrgency = Urgency

export function orderUrgency(
  value: string | undefined,
  nowMs: number
): OrderUrgency {
  return urgencyFor(value, nowMs, WARN_AFTER_MINUTES, DELAYED_AFTER_MINUTES)
}
