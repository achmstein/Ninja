// How long an order has been in the kitchen decides the colour of its
// top bar and clock: amber once it has waited longer than a drink
// should take, red once it is the order someone is about to ask about.
// Slower tiers than the till's pending queue (2/3 min): that one measures
// a cashier's tap, this one measures actually making the thing.
export const WARN_AFTER_MINUTES = 5
export const DELAYED_AFTER_MINUTES = 10

export type OrderUrgency = 'fresh' | 'warning' | 'delayed'

/** What the ticket's bar and clock are saying: how late the order is, that it is done, or that it is off. */
export type CardTone = OrderUrgency | 'ready' | 'cancelled'

export function orderUrgency(
  value: string | null | undefined,
  nowMs: number
): OrderUrgency {
  if (!value) return 'fresh'
  const minutes = (nowMs - new Date(value).getTime()) / 60_000
  if (minutes >= DELAYED_AFTER_MINUTES) return 'delayed'
  if (minutes >= WARN_AFTER_MINUTES) return 'warning'
  return 'fresh'
}

/**
 * How late a ticket is shows in two places only: a thin bar across its top
 * and the colour of its clock. The ticket itself stays white, as everything
 * on the till does; a tinted band on every card made the board one wash of
 * colour. A cancelled ticket's bar is hatched: it is not late, it is off.
 */
export function toneBarClass(tone: CardTone): string {
  switch (tone) {
    case 'cancelled':
      return 'bg-[repeating-linear-gradient(135deg,var(--destructive)_0_8px,transparent_8px_16px)]'
    case 'delayed':
      return 'bg-destructive'
    case 'warning':
      return 'bg-amber-500'
    case 'ready':
      return 'bg-emerald-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

/** The clock, in the bar's colour. */
export function toneClockClass(tone: CardTone): string {
  switch (tone) {
    case 'cancelled':
      return 'text-muted-foreground'
    case 'delayed':
      return 'text-destructive'
    case 'warning':
      return 'text-amber-700 dark:text-amber-400'
    case 'ready':
      return 'text-emerald-700 dark:text-emerald-400'
    default:
      return 'text-foreground'
  }
}

/**
 * Elapsed time as a kitchen clock: `4:12` under an hour, `1h 05m` past it.
 * Seconds matter on a board that is glanced at, not read.
 */
export function formatElapsed(
  value: string | null | undefined,
  nowMs: number
): string {
  if (!value) return ''
  const totalSeconds = Math.max(
    0,
    Math.floor((nowMs - new Date(value).getTime()) / 1000)
  )
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
