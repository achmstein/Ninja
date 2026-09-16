import type {
  LocalizedText,
  PlaceViewModel,
  RateOptionViewModel,
  StayViewModel,
  TariffViewModel,
} from '@/api/spaces/types.gen'
import type { useT } from '@/lib/i18n'

type Translate = ReturnType<typeof useT>

// PlaceKind, as Spaces.API serialises it
export const PLACE_ROOM = 1
export const PLACE_TABLE = 2
export const PLACE_STATION = 3

// PlaceDisplayStatus: what listPlaces returns
export const PLACE_AVAILABLE = 1
export const PLACE_OCCUPIED = 2
export const PLACE_HELD = 3
export const PLACE_OUT_OF_SERVICE = 4

// PlaceStatus: what PUT /api/places/{id}/status accepts. Deliberately
// separate from the display values above: there is no Held here, so
// OutOfService is 3, not 4.
export const PLACE_PHYSICAL_AVAILABLE = 1
export const PLACE_PHYSICAL_OUT_OF_SERVICE = 3

// StayStatus
export const STAY_HELD = 1
export const STAY_RUNNING = 2
export const STAY_ENDED = 3
export const STAY_CANCELLED = 4

/** The one place colour means something on the floor: the place's state. */
export const placeStatusDot: Record<number, string> = {
  [PLACE_AVAILABLE]: 'bg-green-500',
  [PLACE_OCCUPIED]: 'bg-red-500',
  [PLACE_HELD]: 'bg-amber-500',
  [PLACE_OUT_OF_SERVICE]: 'bg-gray-400',
}

export function isRoom(place: PlaceViewModel | null | undefined): boolean {
  return Number(place?.kind ?? PLACE_ROOM) === PLACE_ROOM
}

/** A place with a clock: it has a tariff, so it runs stays. */
export function isTimed(place: PlaceViewModel | null | undefined): boolean {
  return Boolean(place?.isTimed)
}

export function tariffOptions(
  tariff: TariffViewModel | null | undefined,
): RateOptionViewModel[] {
  return tariff?.options ?? []
}

/** A tariff with a choice of rates (single / multi). */
export function hasOptions(tariff: TariffViewModel | null | undefined): boolean {
  return tariffOptions(tariff).length > 1
}

export function findOption(
  tariff: TariffViewModel | null | undefined,
  code: string | null | undefined,
): RateOptionViewModel | undefined {
  return code ? tariffOptions(tariff).find((o) => o.code === code) : undefined
}

// Branded so a failed guard does not narrow the stay away: "not running"
// still leaves "held" on the table for the next check
export type RunningStay = StayViewModel & { readonly __state: 'running' }
export type HeldStay = StayViewModel & { readonly __state: 'held' }

export function isActive(
  stay: StayViewModel | null | undefined,
): stay is RunningStay {
  return stay != null && Number(stay.status) === STAY_RUNNING
}

export function isReserved(
  stay: StayViewModel | null | undefined,
): stay is HeldStay {
  return stay != null && Number(stay.status) === STAY_HELD
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
  nowMs: number,
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
 * running one included, rounded the way the server rounds when the
 * segment closes, at the tariff's rate for its option. The bill only gets
 * the real figure when the stay ends; this is the cashier's preview.
 */
export function estimateSessionCost(
  stay: StayViewModel,
  nowMs: number,
): {
  lines: { code: string; name: LocalizedText | undefined; hours: number; amount: number }[]
  hours: number
  amount: number
} {
  const rounding = Number(stay.tariff?.roundingMinutes ?? 15) || 15
  const lines = tariffOptions(stay.tariff).map((option) => {
    const hours = roundedHours(optionSeconds(stay, option.code, nowMs), rounding)
    return {
      code: option.code ?? '',
      name: option.name,
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

// The server bills in rounding steps (1.25, 2.5, ...) and puts the rounded
// figures on the stay once a segment closes; these read them rather than
// estimating
export function sessionBilledHours(stay: StayViewModel): number {
  return (stay.costs ?? []).reduce((sum, c) => sum + Number(c.hours ?? 0), 0)
}

export function formatBillingHours(
  hours: number | string | undefined,
  t: Translate,
): string {
  return t('billedHoursFormat', { hours: Number(hours ?? 0) })
}

/**
 * The people in the room as the customer picker offers them: everyone on
 * the roster who has an account. A member with no name still shows, as
 * the picker labels the blank.
 */
export function sessionRoster(
  stay: StayViewModel | null | undefined,
): { id: string; name: string }[] {
  return (stay?.members ?? [])
    .filter((member) => member.customerId)
    .map((member) => ({
      id: String(member.customerId),
      name: member.customerName ?? '',
    }))
}

/** The rate options as one line: "Single 50 · Multi 80" or the one rate. */
export function tariffLine(
  tariff: TariffViewModel | null | undefined,
  money: (value: number | string | undefined) => string,
  localized: (text: LocalizedText | null | undefined) => string,
): string {
  const options = tariffOptions(tariff)
  if (options.length === 0) return ''
  if (options.length === 1) return money(options[0].hourlyRate)
  return options
    .map((o) => `${localized(o.name)} ${money(o.hourlyRate)}`)
    .join(' · ')
}
