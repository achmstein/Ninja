import { CheckCircle, Clock, XCircle } from 'lucide-react'
import {
  translate,
  type TranslateParams,
  type TranslationKey,
} from '@/lib/i18n'
import { urgencyFor, type Urgency } from '@/components/queue-card'

export { urgencyTextClass } from '@/components/queue-card'

type OrderStatusValue = 'submitted' | 'confirmed' | 'cancelled'

export const orderStatuses: {
  value: OrderStatusValue
  key: TranslationKey
  variant: 'default' | 'secondary' | 'destructive'
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { value: 'submitted', key: 'pendingStatus', variant: 'default', icon: Clock },
  {
    value: 'confirmed',
    key: 'confirmed',
    variant: 'secondary',
    icon: CheckCircle,
  },
  {
    value: 'cancelled',
    key: 'cancelled',
    variant: 'destructive',
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
}

// Where an order was placed from, for grouping the live board
export type OrderPlace = 'rooms' | 'tables' | 'counter'

export function orderPlace(order: {
  roomName?: { en?: string | null; ar?: string | null } | null
  sessionId?: number | string | null
  tableId?: number | string | null
}): OrderPlace {
  if (order.sessionId != null || order.roomName?.en || order.roomName?.ar) {
    return 'rooms'
  }
  if (order.tableId != null) return 'tables'
  return 'counter'
}

// Localized currency suffix (EGP / ج.م). Callers all live inside components
// that re-render on language change, so reading the store here stays fresh.
export function formatEgp(value: number | string | undefined | null): string {
  return `${Number(value ?? 0).toFixed(2)} ${translate('currency')}`
}

export function relativeTime(
  value: string | undefined,
  nowMs: number,
  t: (key: TranslationKey, params?: TranslateParams) => string,
  locale: string
): string {
  if (!value) return ''
  const minutes = Math.round((nowMs - new Date(value).getTime()) / 60_000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { minutes })
  const hours = Math.round(minutes / 60)
  return hours < 24
    ? t('hoursAgo', { hours })
    : new Date(value).toLocaleDateString(locale)
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
