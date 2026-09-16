import { Armchair, Gamepad2, Trophy } from 'lucide-react'
import {
  type LocalizedText,
  type PlaceViewModel,
  type RateOptionViewModel,
  type StayViewModel,
  type TariffViewModel,
} from '@/api/spaces'
import { type TranslationKey } from '@/lib/i18n'

// PlaceKind, as Spaces.API serialises it
export const PLACE_ROOM = 1
export const PLACE_TABLE = 2
export const PLACE_STATION = 3

/** The kinds in the order the floor lists them: rooms, tables, stations. */
export const placeKinds: { kind: number; key: TranslationKey }[] = [
  { kind: PLACE_ROOM, key: 'rooms' },
  { kind: PLACE_TABLE, key: 'tables' },
  { kind: PLACE_STATION, key: 'stations' },
]

/** One icon per kind, everywhere a place is drawn. Ordering spells the
 *  kind by name ("Table"); Spaces serialises it as a number. */
export function placeKindIcon(kind: number | string | null | undefined) {
  if (kind === PLACE_TABLE || kind === 'Table') return Armchair
  if (kind === PLACE_STATION || kind === 'Station') return Trophy
  return Gamepad2
}

export const placeKindKey: Record<number, TranslationKey> = {
  [PLACE_ROOM]: 'placeKindRoom',
  [PLACE_TABLE]: 'placeKindTable',
  [PLACE_STATION]: 'placeKindStation',
}

// PlaceDisplayStatus: what listPlaces returns
export const PLACE_AVAILABLE = 1
export const PLACE_OCCUPIED = 2
export const PLACE_HELD = 3
export const PLACE_OUT_OF_SERVICE = 4

// PlaceStatus: what PUT /api/places/{id}/status accepts. Deliberately
// separate from the display values above: there is no Held here, so
// OutOfService is 3, not 4. Passing a display value would set the place
// to Occupied instead.
export const PLACE_PHYSICAL_AVAILABLE = 1
export const PLACE_PHYSICAL_OUT_OF_SERVICE = 3

export const placeStatusConfig: Record<
  number,
  { key: TranslationKey; dotClass: string }
> = {
  [PLACE_AVAILABLE]: { key: 'statusAvailable', dotClass: 'bg-green-500' },
  [PLACE_OCCUPIED]: { key: 'statusOccupied', dotClass: 'bg-red-500' },
  [PLACE_HELD]: { key: 'held', dotClass: 'bg-amber-500' },
  [PLACE_OUT_OF_SERVICE]: { key: 'outOfService', dotClass: 'bg-gray-400' },
}

// StayStatus
export const STAY_HELD = 1
export const STAY_RUNNING = 2
export const STAY_ENDED = 3
export const STAY_CANCELLED = 4

export function isRunning(stay: StayViewModel | null | undefined): boolean {
  return stay != null && Number(stay.status) === STAY_RUNNING
}

export function isHeld(stay: StayViewModel | null | undefined): boolean {
  return stay != null && Number(stay.status) === STAY_HELD
}

export function tariffOptions(
  tariff: TariffViewModel | null | undefined
): RateOptionViewModel[] {
  return tariff?.options ?? []
}

/** A tariff with a choice of rates to make. */
export function hasOptions(
  tariff: TariffViewModel | null | undefined
): boolean {
  return tariffOptions(tariff).length > 1
}

export function findOption(
  tariff: TariffViewModel | null | undefined,
  code: string | null | undefined
): RateOptionViewModel | undefined {
  return code ? tariffOptions(tariff).find((o) => o.code === code) : undefined
}

/** The open stay on a place, if any: running first, then held. */
export function stayForPlace(
  stays: StayViewModel[],
  placeId: number | string | undefined
): StayViewModel | undefined {
  const own = stays.filter((s) => Number(s.placeId) === Number(placeId))
  return own.find(isRunning) ?? own.find(isHeld)
}

/** Whole-number rates print bare ("60"), fractions keep their decimals. */
export function formatRate(rate: number | string | undefined): string {
  const value = Number(rate ?? 0)
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/**
 * The tariff as one line under the place's name: "Single 60 · Multi 90 /hr"
 * when there is a choice, "40 /hr" for one rate, or "Orders only".
 */
export function tariffLine(
  place: PlaceViewModel,
  t: (key: TranslationKey) => string,
  localized: (text: LocalizedText | null | undefined) => string
): string {
  const options = tariffOptions(place.tariff)
  if (options.length === 0) return t('ordersOnly')
  const rates =
    options.length === 1
      ? formatRate(options[0].hourlyRate)
      : options
          .map((o) => `${localized(o.name)} ${formatRate(o.hourlyRate)}`)
          .join(' · ')
  return `${rates} ${t('perHour')}`
}

/** Orders names the way people read them: "Room 2" before "Room 10". */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

/** Rooms, then tables, then stations; by name within a kind. */
export function comparePlaces(
  localized: (text: LocalizedText | null | undefined) => string
) {
  return (a: PlaceViewModel, b: PlaceViewModel) =>
    Number(a.kind ?? PLACE_ROOM) - Number(b.kind ?? PLACE_ROOM) ||
    naturalCompare(localized(a.name), localized(b.name))
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Seconds since the stay's clock started. */
export function elapsedSeconds(stay: StayViewModel, nowMs: number): number {
  return stay.startedAt
    ? (nowMs - new Date(stay.startedAt).getTime()) / 1000
    : 0
}

/** Seconds spent on one rate option across the stay's segments. */
export function optionSeconds(
  stay: StayViewModel,
  code: string | undefined,
  nowMs: number
): number {
  return (stay.segments ?? [])
    .filter((segment) => segment.optionCode === code && segment.startTime)
    .reduce((sum, segment) => {
      const end = segment.endTime ? new Date(segment.endTime).getTime() : nowMs
      return sum + (end - new Date(segment.startTime!).getTime()) / 1000
    }, 0)
}

/**
 * The server's rounding, in the open: minutes to the nearest step of the
 * tariff (a quarter hour by default), halves away from zero.
 */
export function roundedHours(seconds: number, roundingMinutes = 15): number {
  const minutes = seconds / 60
  if (minutes <= 0) return 0
  return (Math.round(minutes / roundingMinutes) * roundingMinutes) / 60
}

/**
 * What the stay would cost if it ended this second: every segment, the
 * running one included, rounded the way the server rounds when a segment
 * closes, at the tariff snapshot's rate for its option. The bill only gets
 * the real figure when the stay ends; this is the preview.
 */
export function estimateStayCost(
  stay: StayViewModel,
  nowMs: number
): {
  lines: {
    code: string
    name: LocalizedText | undefined
    seconds: number
    hours: number
    amount: number
  }[]
  hours: number
  amount: number
} {
  const rounding = Number(stay.tariff?.roundingMinutes ?? 15) || 15
  const lines = tariffOptions(stay.tariff).map((option) => {
    const seconds = optionSeconds(stay, option.code, nowMs)
    const hours = roundedHours(seconds, rounding)
    return {
      code: option.code ?? '',
      name: option.name,
      seconds,
      hours,
      amount: hours * Number(option.hourlyRate ?? 0),
    }
  })
  return {
    lines,
    hours: lines.reduce((sum, l) => sum + l.hours, 0),
    amount: lines.reduce((sum, l) => sum + l.amount, 0),
  }
}

export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

// The server bills in rounding steps (1.25, 2.5, ...) and puts the rounded
// figures on the stay once it ends; these read them rather than estimating.
export function formatBillingHours(
  hours: number | string | undefined,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  return t('billedHoursFormat', { hours: Number(hours ?? 0) })
}

export function stayBilledHours(stay: StayViewModel): number {
  return (stay.costs ?? []).reduce((sum, c) => sum + Number(c.hours ?? 0), 0)
}

/** "Single 1.25h · Multi 0.5h": the ended stay's hours per rate option. */
export function stayBreakdown(
  stay: StayViewModel,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  localized: (text: LocalizedText | null | undefined) => string
): string {
  return (stay.costs ?? [])
    .filter((c) => Number(c.hours ?? 0) > 0)
    .map((c) => `${localized(c.optionName)} ${formatBillingHours(c.hours, t)}`)
    .join(' · ')
}
