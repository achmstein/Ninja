import { useLocale } from '@/lib/i18n'

/** Date + time and date-only formatters in the active locale. */
export function useFormat() {
  const locale = useLocale()
  return {
    date: (value: string | null | undefined) =>
      value
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(value)
          )
        : '',
    dateTime: (value: string | null | undefined) =>
      value
        ? new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(value))
        : '',
  }
}

/** "3s", "1m 12s", "2h 05m": the span between two instants, or until now. */
export function duration(
  from: string | null | undefined,
  to: string | null | undefined,
  nowMs = Date.now()
): string {
  if (!from) return ''
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : nowMs
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}
