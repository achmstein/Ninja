import type { useT } from '@/lib/i18n'

type Translate = ReturnType<typeof useT>

export function relativeTime(
  value: string | undefined,
  nowMs: number,
  t: Translate,
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

// KDS-style aging, the same tiers as the admin board and matched to the
// backend reminder escalation (drinks move fast here): amber after 2
// minutes, red once it's the 3-minute order the reminders are already
// ringing about
export const WARN_AFTER_MINUTES = 2
export const DELAYED_AFTER_MINUTES = 3

export type OrderUrgency = 'fresh' | 'warning' | 'delayed'

export function orderUrgency(
  value: string | undefined,
  nowMs: number
): OrderUrgency {
  if (!value) return 'fresh'
  const minutes = (nowMs - new Date(value).getTime()) / 60_000
  if (minutes >= DELAYED_AFTER_MINUTES) return 'delayed'
  if (minutes >= WARN_AFTER_MINUTES) return 'warning'
  return 'fresh'
}

/** Colouring for an order's age text — the one place colour means something on the floor. */
export function urgencyTextClass(urgency: OrderUrgency): string {
  return urgency === 'delayed'
    ? 'text-destructive font-medium'
    : urgency === 'warning'
      ? 'font-medium text-amber-600 dark:text-amber-500'
      : 'text-muted-foreground'
}
