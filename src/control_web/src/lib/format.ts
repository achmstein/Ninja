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

/** Megabytes as people read them: "512 MB", "1.5 GB", "120 GB". */
export function megabytes(mb: number | null | undefined): string {
  const n = mb ?? 0
  if (n < 1024) return `${Math.round(n)} MB`
  const gb = n / 1024
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`
}

/** A share as a whole percentage, never past 100. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.min(100, Math.round((part / whole) * 100))
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
