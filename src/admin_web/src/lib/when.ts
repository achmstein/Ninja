import type { TranslateParams, TranslationKey } from '@/lib/i18n'

/**
 * One way to say when, across the admin, where there were five: never
 * seconds, the year only when it is not this year, and in a list grouped by
 * day only the time (the day is in the heading).
 *
 * - time: "14:32"
 * - day: "Fri 3 Oct" ("Fri 3 Oct 2025" in another year)
 * - date: "3 Oct" ("3 Oct 2025")
 * - dateTime: "3 Oct, 14:32"
 * - relative: "Just now", "5m ago", "3h ago", "Yesterday 14:32", then as day
 */
export type WhenMode = 'time' | 'day' | 'date' | 'dateTime' | 'relative'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export function formatWhen(
  value: Date | string | number | null | undefined,
  mode: WhenMode,
  locale: string,
  t: Translate,
  now: Date = new Date()
): string {
  const date = toDate(value)
  if (!date) return '—'
  const thisYear = date.getFullYear() === now.getFullYear()
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
  })
  const dayMonth = (weekday: boolean) =>
    date.toLocaleDateString(locale, {
      weekday: weekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: thisYear ? undefined : 'numeric',
    })

  switch (mode) {
    case 'time':
      return time
    case 'day':
      return dayMonth(true)
    case 'date':
      return dayMonth(false)
    case 'dateTime':
      return `${dayMonth(false)}, ${time}`
    case 'relative': {
      const minutes = Math.round((now.getTime() - date.getTime()) / 60_000)
      if (minutes < 1) return t('justNow')
      if (minutes < 60) return t('minutesAgo', { minutes })
      if (sameDay(date, now))
        return t('hoursAgo', { hours: Math.round(minutes / 60) })
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      if (sameDay(date, yesterday)) return `${t('yesterday')} ${time}`
      return dayMonth(true)
    }
  }
}

/** The full moment, for a tooltip under a relative or a time-only one: "Fri 3 Oct 2026, 14:32" */
export function formatFull(
  value: Date | string | number | null | undefined,
  locale: string
): string {
  const date = toDate(value)
  if (!date) return ''
  return date.toLocaleString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** The local day a moment falls on, as yyyy-MM-dd: what a list groups its rows by. */
export function dayKey(
  value: Date | string | number | null | undefined
): string {
  const date = toDate(value)
  if (!date) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** A day group's heading: "Today", "Yesterday", or "Fri 3 Oct". */
export function dayHeading(
  key: string,
  locale: string,
  t: Translate,
  now: Date = new Date()
): string {
  const [y, m, d] = key.split('-').map(Number)
  if (!y) return ''
  const date = new Date(y, m - 1, d)
  if (sameDay(date, now)) return t('today')
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(date, yesterday)) return t('yesterday')
  return formatWhen(date, 'day', locale, t, now)
}
