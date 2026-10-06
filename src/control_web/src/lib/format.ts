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

/**
 * A file's size in the unit that reads best: "0 B", "512 B", "23 KB", "4.2 MB",
 * "1.5 GB". A backup of a few hundred kilobytes (the platform's own: two
 * compressed dumps) reads as such, never rounded down to "0 MB".
 */
export function bytes(value: number | null | undefined): string {
  const n = Math.max(0, value ?? 0)
  if (n < 1024) return `${Math.round(n)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let size = n / 1024
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  // Rounding 1023.7 KB up would read "1024 KB": step to the next unit instead
  if (Math.round(size) >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size < 10 ? size.toFixed(1).replace(/\.0$/, '') : Math.round(size)} ${units[unit]}`
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
