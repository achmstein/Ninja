// How long an order has been in the kitchen decides the colour of its
// header band and clock: amber once it has waited longer than a drink
// should take, red once it is the order someone is about to ask about.
// Slower tiers than the till's pending queue (2/3 min): that one measures
// a cashier's tap, this one measures actually making the thing.
export const WARN_AFTER_MINUTES = 5
export const DELAYED_AFTER_MINUTES = 10

export type OrderUrgency = 'fresh' | 'warning' | 'delayed'

/** What the card's header band is saying: how late the order is, or that it is done. */
export type CardTone = OrderUrgency | 'ready'

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
 * The header band is the one place colour means something on the board:
 * the whole strip tints with the clock, the way every kitchen display does
 * it, so a late ticket is read across the room and not from a thin border.
 */
export function toneBandClass(tone: CardTone): string {
  switch (tone) {
    case 'delayed':
      return 'bg-destructive/10 dark:bg-destructive/20'
    case 'warning':
      return 'bg-amber-500/15 dark:bg-amber-500/20'
    case 'ready':
      return 'bg-emerald-500/15 dark:bg-emerald-500/20'
    default:
      return 'bg-muted/50'
  }
}

/** The clock on the band, in the band's colour. */
export function toneClockClass(tone: CardTone): string {
  switch (tone) {
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

/** A late card's outline picks up the band's colour too, faintly. */
export function toneBorderClass(tone: CardTone): string {
  switch (tone) {
    case 'delayed':
      return 'border-destructive/40'
    case 'warning':
      return 'border-amber-500/40'
    case 'ready':
      return 'border-emerald-500/40'
    default:
      return ''
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
