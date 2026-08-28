import { CheckCircle, Clock, XCircle } from 'lucide-react'
import { type TranslationKey } from '@/lib/i18n'

export type OrderStatusValue = 'submitted' | 'confirmed' | 'cancelled'

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

export function formatEgp(value: number | string | undefined | null): string {
  return `${Number(value ?? 0).toFixed(2)} EGP`
}
