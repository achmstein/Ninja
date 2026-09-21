import { createElement } from 'react'
import { Armchair, Gamepad2, Trophy } from 'lucide-react'
import type {
  LocalizedText,
  PlaceScanViewModel,
  PlaceViewModel,
  StayViewModel,
  TariffViewModel,
} from '@/api/spaces'
import type { TranslationKey } from '@/lib/i18n'

// PlaceKind, as Spaces.API serialises it
export const PLACE_ROOM = 1
export const PLACE_TABLE = 2
export const PLACE_STATION = 3

// PlaceDisplayStatus: what listPlaces returns
export const PLACE_AVAILABLE = 1
export const PLACE_OCCUPIED = 2
export const PLACE_HELD = 3
export const PLACE_OUT_OF_SERVICE = 4

// StayStatus (1 was Held, before the reservation became its own thing)
export const STAY_RUNNING = 2
export const STAY_ENDED = 3
export const STAY_CANCELLED = 4

// ReservationStatus
export const RESERVATION_REQUESTED = 1
export const RESERVATION_CONFIRMED = 2
export const RESERVATION_SEATED = 3
export const RESERVATION_CANCELLED = 4
export const RESERVATION_EXPIRED = 5

/** The kind as the services spell it in events and requests. */
export function placeKindName(
  kind: number | undefined,
): 'Room' | 'Table' | 'Station' {
  return kind === PLACE_TABLE
    ? 'Table'
    : kind === PLACE_STATION
      ? 'Station'
      : 'Room'
}

/** One icon per kind, everywhere a place is drawn. */
export function placeIcon(kind: number | undefined) {
  return kind === PLACE_TABLE
    ? Armchair
    : kind === PLACE_STATION
      ? Trophy
      : Gamepad2
}

/** The same icon as a component, for use inside render. */
export function PlaceIcon({
  kind,
  className,
}: {
  kind: number | undefined
  className?: string
}) {
  const Icon = placeIcon(kind)
  return createElement(Icon, { className })
}

export const placeStatusMeta: Record<
  number,
  { key: TranslationKey; className: string }
> = {
  [PLACE_AVAILABLE]: {
    key: 'available',
    className: 'text-green-600 dark:text-green-500',
  },
  [PLACE_OCCUPIED]: { key: 'occupied', className: 'text-destructive' },
  [PLACE_HELD]: {
    key: 'reserved',
    className: 'text-amber-600 dark:text-amber-500',
  },
  [PLACE_OUT_OF_SERVICE]: {
    key: 'maintenance',
    className: 'text-muted-foreground',
  },
}

export function tariffOptions(tariff: TariffViewModel | null | undefined) {
  return tariff?.options ?? []
}

/** A tariff with a choice to make: the till and the customer pick an option. */
export function hasOptions(
  tariff: TariffViewModel | null | undefined,
): boolean {
  return tariffOptions(tariff).length > 1
}

/** A place a customer can reserve for now: bookable, taking customers, free right now. */
export function canHold(place: PlaceViewModel | PlaceScanViewModel): boolean {
  return Boolean(place.canReserve) && Number(place.status) === PLACE_AVAILABLE
}

/** Whether the stay's place takes a controller request (a console room). */
export function stayTakesControllerRequests(stay: StayViewModel): boolean {
  return Number(stay.placeKind ?? PLACE_ROOM) === PLACE_ROOM
}

export type OptionColor = { text: string; dot: string; chip: string }

/** The colour of a rate option by its place in the tariff: the first reads
 *  as the base rate, the second as the upgrade — the way Single and Multi
 *  always did. */
export function optionColor(
  tariff: TariffViewModel | null | undefined,
  code: string | undefined,
): OptionColor {
  const index = tariffOptions(tariff).findIndex((o) => o.code === code)
  return index > 0
    ? {
        text: 'text-orange-500',
        dot: 'bg-orange-500',
        chip: 'bg-orange-500/10 text-orange-500',
      }
    : {
        text: 'text-primary',
        dot: 'bg-primary',
        chip: 'bg-primary/10 text-primary',
      }
}

export function optionName(
  tariff: TariffViewModel | null | undefined,
  code: string | undefined,
): LocalizedText | undefined {
  return tariffOptions(tariff).find((o) => o.code === code)?.name
}
