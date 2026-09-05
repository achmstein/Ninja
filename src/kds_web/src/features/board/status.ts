// How long an order has been in the kitchen decides the colour of its clock
// and border: amber once it has waited longer than a drink should take, red
// once it is the order someone is about to ask about. Slower tiers than the
// till's pending queue (2/3 min): that one measures a cashier's tap, this
// one measures actually making the thing.
export const WARN_AFTER_MINUTES = 5
export const DELAYED_AFTER_MINUTES = 10

export type OrderUrgency = 'fresh' | 'warning' | 'delayed'

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

/** Colouring for an order's clock — the one place colour means something on the board. */
export function urgencyTextClass(urgency: OrderUrgency): string {
  return urgency === 'delayed'
    ? 'text-destructive'
    : urgency === 'warning'
      ? 'text-amber-600 dark:text-amber-500'
      : 'text-muted-foreground'
}

/** The card border follows the clock, so a late order stands out across the room. */
export function urgencyBorderClass(urgency: OrderUrgency): string {
  return urgency === 'delayed'
    ? 'border-destructive/70'
    : urgency === 'warning'
      ? 'border-amber-500/70'
      : ''
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
