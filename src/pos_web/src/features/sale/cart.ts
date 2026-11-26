import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CatalogItemDto } from '@/api/catalog/types.gen'

// The counter-sale cart, ported from client_web/src/lib/cart.ts.

// A snapshot of a chosen customization option at add-to-cart time
export type SaleCustomization = {
  customizationId: number
  customizationNameEn: string
  customizationNameAr?: string
  optionId: number
  optionNameEn: string
  optionNameAr?: string
  priceAdjustment: number
}

// A snapshot of the item at add time; the backend re-validates everything
// when the order is created. Names are as the business wrote them: '' for a
// language it does not write in, never a copy of the other one.
export type SaleLine = {
  productId: number
  nameEn: string
  nameAr: string
  /** Unit price including customization adjustments */
  price: number
  pictureUrl?: string
  quantity: number
  specialInstructions?: string
  customizations: SaleCustomization[]
  /**
   * Rung up from what the last item goes well with. Not part of the line's
   * key: added again by hand it is the same line, and keeps saying so.
   */
  suggestion?: 'Till'
  /**
   * Who this line is for, on an open bill: a round is rung up person by
   * person, each line under whoever was picked when it was tapped. Missing
   * on a new sale, which is one customer's whole.
   */
  for?: SaleCustomer | null
}

/**
 * Who the sale is for. `id` is an identity account — needed to accrue loyalty
 * or settle on a tab. A walk-in the waiters know by name has none: the name
 * still rides along to the kitchen card and the bill line, it just unlocks
 * nothing.
 */
export type SaleCustomer = {
  id: string | null
  name: string
  /** As the search knew it; shown on the customer card. */
  phone?: string | null
}

/**
 * Where a sale the till took over the phone goes. The words are what the
 * caller said; the pin only when they shared their location (a pasted map
 * link, read by Ordering into `latitude`/`longitude`).
 */
export type SaleDelivery = {
  address: string
  building: string
  floor: string
  apartment: string
  directions: string
  phone: string
  /** What the cashier pasted: a Google Maps link or coordinates */
  location: string
  latitude: number | null
  longitude: number | null
  /** Another branch, nearer the caller, makes and delivers it; null (or missing) keeps it here */
  sendTo?: SaleSendTo | null
  /** The branch's named area the cashier picked (or the pin fell in); null (or missing) charges the branch's own fee */
  zone?: SaleZone | null
  /** The rider picked while the call was on, given it as soon as it is placed; null (or missing) to give it later */
  rider?: SaleRider | null
  /**
   * Where the pin came from: Search (found on the map here), Customer or Rider (an earlier address of
   * theirs), Shared (the caller shared it through the link); missing with a pin is Search
   */
  pinSource?: PinSource | null
  /** The location link sent to the caller: a location they share after the order is placed still lands on it */
  locationShareToken?: string | null
}

/** Where a delivery's pin came from, which says how far a rider can trust it */
export type PinSource = 'Customer' | 'Shared' | 'Rider' | 'Search' | 'None'

/** One of the branch's riders, as the delivery form picked them */
export type SaleRider = {
  userId: string
  name: string
}

/** A branch's named delivery area as the sale keeps it: its name and what holds there when it was picked */
export type SaleZone = {
  id: number
  name: { en: string | null; ar: string | null }
  fee: number
  minimumOrder: number
  etaMinutes: number | null
}

/** The branch a phone delivery is sent to, with what it asks, as the till's quote offered it */
export type SaleSendTo = {
  branchId: number
  fee: number
  minimumOrder: number
  distanceMeters: number
  paused: boolean
}

export const emptyDelivery: SaleDelivery = {
  address: '',
  building: '',
  floor: '',
  apartment: '',
  directions: '',
  phone: '',
  location: '',
  latitude: null,
  longitude: null,
  sendTo: null,
  zone: null,
  rider: null,
}

/**
 * A line's unit price before its options. The line's `price` has them in it
 * (what the pad shows); Ordering adds them itself, so this is what it is sent.
 */
export function basePrice(
  line: Pick<SaleLine, 'price' | 'customizations'>
): number {
  return (
    line.price -
    line.customizations.reduce((sum, c) => sum + c.priceAdjustment, 0)
  )
}

/**
 * What the till offers after an item is rung up: what it goes well with, in
 * the business's order, only what this branch sells right now and nothing
 * already on the sale.
 */
export function tillSuggestions(
  last: CatalogItemDto | null,
  items: readonly CatalogItemDto[],
  lines: readonly Pick<SaleLine, 'productId'>[],
): CatalogItemDto[] {
  if (!last) return []
  const byId = new Map(items.map((item) => [String(item.id), item]))
  const onSale = new Set(lines.map((line) => line.productId))
  return (last.pairedItemIds ?? [])
    .map((id) => byId.get(String(id)))
    .filter(
      (item): item is CatalogItemDto =>
        !!item &&
        item.isAvailable !== false &&
        String(item.id) !== String(last.id) &&
        !onSale.has(Number(item.id)),
    )
}

/** One person, however the till knows them: by their account, else by the name it was told; '' for nobody */
export function personKey(person: SaleCustomer | null | undefined): string {
  if (!person) return ''
  return person.id ? `id:${person.id}` : `name:${person.name.trim()}`
}

export function lineKey(
  line: Pick<SaleLine, 'productId' | 'customizations' | 'specialInstructions' | 'for'>
): string {
  const options = line.customizations
    .map((c) => c.optionId)
    .sort((a, b) => a - b)
    .join(',')
  // The same item for two people is two lines; nobody's keeps the key it always had
  const who = personKey(line.for)
  return `${line.productId}:${options}:${line.specialInstructions ?? ''}${who ? `@${who}` : ''}`
}

/** Lines that became the same line (same item, same person) are one again */
function merged(lines: SaleLine[]): SaleLine[] {
  const out: SaleLine[] = []
  for (const line of lines) {
    const at = out.findIndex((l) => lineKey(l) === lineKey(line))
    if (at < 0) out.push(line)
    else out[at] = { ...out[at], quantity: out[at].quantity + line.quantity }
  }
  return out
}

/**
 * A round's lines by who they are for, in the order each person first
 * appears: one order is placed per person, so each gets their points and
 * their history. When no line names anybody the round is `fallback`'s whole.
 */
export function linesByPerson(
  lines: SaleLine[],
  fallback: SaleCustomer | null,
): { who: SaleCustomer | null; lines: SaleLine[] }[] {
  if (!lines.some((l) => l.for)) return [{ who: fallback, lines }]
  const groups: { who: SaleCustomer | null; lines: SaleLine[] }[] = []
  for (const line of lines) {
    const key = personKey(line.for)
    const group = groups.find((g) => personKey(g.who) === key)
    if (group) group.lines.push(line)
    else groups.push({ who: line.for ?? null, lines: [line] })
  }
  return groups
}

type SaleState = {
  lines: SaleLine[]
  note: string
  customer: SaleCustomer | null
  /** A walk-in sale that goes out with a rider instead; never on an open bill. */
  delivery: SaleDelivery | null
  /** The bill these lines are for: a ticket id, or null for a walk-in sale. */
  target: number | null
  /**
   * Point the cart at a destination. Changing it empties the cart: a
   * half-built walk-in must never follow the cashier onto someone's open
   * ticket (or the other way round) — those are different people's money.
   */
  setTarget: (target: number | null) => void
  add: (line: SaleLine) => void
  setQuantity: (key: string, quantity: number) => void
  /** Moves one line to another person (or to nobody) */
  assignLine: (key: string, person: SaleCustomer | null) => void
  /** Lines rung up before anybody was picked become this person's */
  adoptUnassigned: (person: SaleCustomer) => void
  setNote: (note: string) => void
  setCustomer: (customer: SaleCustomer | null) => void
  setDelivery: (delivery: SaleDelivery | null) => void
  clear: () => void
}

export const useSale = create<SaleState>()(
  persist(
    (set) => ({
      lines: [],
      note: '',
      customer: null,
      delivery: null,
      target: null,
      setTarget: (target) =>
        set((state) =>
          state.target === target
            ? {}
            : { target, lines: [], note: '', customer: null, delivery: null }
        ),
      add: (line) =>
        set((state) => {
          const key = lineKey(line)
          const existing = state.lines.find((l) => lineKey(l) === key)
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                lineKey(l) === key
                  ? { ...l, quantity: l.quantity + line.quantity }
                  : l
              ),
            }
          }
          return { lines: [...state.lines, line] }
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => lineKey(l) !== key)
              : state.lines.map((l) =>
                  lineKey(l) === key ? { ...l, quantity } : l
                ),
        })),
      assignLine: (key, person) =>
        set((state) => ({
          lines: merged(state.lines.map((l) => (lineKey(l) === key ? { ...l, for: person } : l))),
        })),
      adoptUnassigned: (person) =>
        set((state) => ({
          lines: merged(state.lines.map((l) => (l.for ? l : { ...l, for: person }))),
        })),
      setNote: (note) => set({ note }),
      setCustomer: (customer) => set({ customer }),
      setDelivery: (delivery) => set({ delivery }),
      clear: () => set({ lines: [], note: '', customer: null, delivery: null }),
    }),
    // Survives an accidental refresh mid-sale; cleared when the sale lands
    { name: 'ninja-pos-sale' }
  )
)

export function saleTotal(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.price * l.quantity, 0)
}

export function saleCount(lines: SaleLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}
