// The pure parts of how the till shows a delivery: its address on one line,
// how far it is, where its map and its phone go, and which lane of the board
// it stands in. Kept apart from the components so they can be tested.

/** What a delivery's address needs, whichever view it came in */
export type AddressParts = {
  address?: string | null
  building?: string | null
  floor?: string | null
  apartment?: string | null
}

/** The words for the address parts, in the till's language */
export type AddressWords = { building: string; floor: string; apartment: string }

/**
 * The separator a language puts between items of a list, without its "and":
 * ", " in English, "، " in Arabic. Taken from Intl, so nothing hard-codes a
 * language's comma.
 */
export function listSeparator(locale: string): string {
  // Intl.ListFormat is ES2021, newer than this app's TypeScript lib: typed here, and a browser without it gets ", "
  const ListFormat = (Intl as unknown as { ListFormat?: new (locale: string, options: object) => ListFormatLike }).ListFormat
  if (!ListFormat) return ', '
  try {
    const parts = new ListFormat(locale, { type: 'unit', style: 'short' }).formatToParts(['a', 'b', 'c'])
    const literal = parts.find((p) => p.type === 'literal')?.value ?? ', '
    // Some locales' unit lists say "and" between every item (Arabic's "، و"): keep the punctuation only
    const separator = literal.replace(/\p{L}+\s*$/u, '')
    return separator.trim() ? separator.replace(/\s*$/, ' ') : ', '
  } catch {
    return ', '
  }
}

type ListFormatLike = { formatToParts(list: string[]): { type: string; value: string }[] }

/** The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3" */
export function formatAddressLine(parts: AddressParts, words: AddressWords, locale: string): string {
  const details = [
    parts.building ? `${words.building} ${parts.building}` : null,
    parts.floor ? `${words.floor} ${parts.floor}` : null,
    parts.apartment ? `${words.apartment} ${parts.apartment}` : null,
  ].filter((p): p is string => p != null)
  const street = parts.address?.trim() ?? ''
  if (details.length === 0) return street
  return street ? `${street} · ${details.join(listSeparator(locale))}` : details.join(listSeparator(locale))
}

/** How far, said briefly: under a kilometre to the nearest 10 m (at least 10), else to a tenth of a km */
export function distanceParts(meters: number): { unit: 'm' | 'km'; value: number } {
  return meters < 950
    ? { unit: 'm', value: Math.max(10, Math.round(meters / 10) * 10) }
    : { unit: 'km', value: Math.round(meters / 100) / 10 }
}

/**
 * Google Maps' way to the door, from wherever the rider is: to the pin, or,
 * for an address the till took over the phone without one, to its words.
 */
export function directionsUrl(target: { latitude?: number | string | null; longitude?: number | string | null; address?: string | null }): string {
  const lat = target.latitude == null ? null : Number(target.latitude)
  const lng = target.longitude == null ? null : Number(target.longitude)
  const destination =
    lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)
      ? `${lat},${lng}`
      : encodeURIComponent(target.address ?? '')
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/** A phone as a dialer link: digits and a leading plus only, whatever was typed */
export function telHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').trim().replace(/(?!^\+)[^\d]/g, '')
  return /\d/.test(digits) ? `tel:${digits}` : null
}

export type DeliveryStage = 'Waiting' | 'Assigned' | 'OnTheWay' | 'Delivered' | 'Failed' | 'Returned'

/** The server's stage names; anything else (a newer server) reads as waiting rather than vanishing */
export function stageOf(stage: string | null | undefined): DeliveryStage {
  switch (stage) {
    case 'Assigned':
    case 'OnTheWay':
    case 'Delivered':
    case 'Failed':
    case 'Returned':
      return stage
    default:
      return 'Waiting'
  }
}

/**
 * Where a delivery stands for the till, from the server's stage (the one
 * authority on it): nobody has it; a rider has it; it couldn't be delivered
 * and is on its way back; it is back at the branch; its cash is still out;
 * or it is settled.
 */
export type DeliveryLane = 'waiting' | 'withRider' | 'failed' | 'returned' | 'cashDue' | 'done'

export function laneOf(order: {
  paidAt?: string | null
  delivery?: { stage?: string | null; cashHandedInAt?: string | null } | null
}): DeliveryLane {
  const d = order.delivery
  if (d?.cashHandedInAt || order.paidAt) return 'done'
  switch (stageOf(d?.stage)) {
    case 'Delivered':
      return 'cashDue'
    case 'Failed':
      return 'failed'
    case 'Returned':
      return 'returned'
    case 'Assigned':
    case 'OnTheWay':
      return 'withRider'
    default:
      return 'waiting'
  }
}

/** The board's order: what needs the till first (nobody has it, it failed), then what is out, then what came back */
export const LANES: readonly DeliveryLane[] = ['waiting', 'failed', 'withRider', 'cashDue', 'returned']

/** Live deliveries in board order, each lane oldest first as the server sent them */
export function boardOrder<T extends Parameters<typeof laneOf>[0]>(orders: readonly T[]): T[] {
  return LANES.flatMap((lane) => orders.filter((o) => laneOf(o) === lane))
}

/**
 * The order a delivery's bill was opened for, read from the bill's label
 * ("#42 · Mona", as Sales names it); null for any other bill. Sales says
 * nothing else about it, so the floor matches it to the deliveries board.
 */
export function deliveryOrderOfLabel(label: string | null | undefined): number | null {
  const match = /^#(\d+)(\s·|$)/.exec(label?.trim() ?? '')
  return match ? Number(match[1]) : null
}

/** A bill's label as the till shows it, and whether it is a delivery's bill (drawn with the bike) */
export function billLabel(label: string | null | undefined): { text: string; delivery: boolean } {
  const text = label?.trim() ?? ''
  return { text, delivery: deliveryOrderOfLabel(text) != null }
}

/** Collected minus due, to the piastre; null until the cash is in */
export function cashDifference(collected: number | null | undefined, total: number): number | null {
  if (collected == null || !Number.isFinite(collected)) return null
  return Math.round((collected - total) * 100) / 100
}
