/**
 * A moment as the till says it to a cashier: the day in words (Today,
 * Yesterday, otherwise the weekday and the date) and the time on its own.
 * A list of the night's receipts is read by its times; the date on every
 * row said the same thing fifty times.
 */

/** One calendar day, in the device's own time: what two moments of the same day share */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

export function friendlyDay(date: Date, locale: string, words: { today: string; yesterday: string }, now: Date = new Date()): string {
  if (dayKey(date) === dayKey(now)) return words.today
  const before = new Date(now)
  before.setDate(now.getDate() - 1)
  if (dayKey(date) === dayKey(before)) return words.yesterday
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    // The year only once it is not this one
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  }).format(date)
}

export function friendlyTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date)
}
