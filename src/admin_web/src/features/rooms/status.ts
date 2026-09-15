import { type ReservationViewModel } from '@/api/spaces'
import { type TranslationKey } from '@/lib/i18n'

// RoomDisplayStatus enum values from Spaces.API — what listRooms returns
export const ROOM_AVAILABLE = 1
const ROOM_OCCUPIED = 2
const ROOM_RESERVED = 3
export const ROOM_MAINTENANCE = 4

// RoomPhysicalStatus enum values — what PUT /api/rooms/{id}/status accepts.
// Deliberately separate from the display values above: there is no Reserved
// here, so Maintenance is 3, not 4. Passing a display value would set the room
// to Occupied instead.
export const ROOM_PHYSICAL_AVAILABLE = 1
export const ROOM_PHYSICAL_MAINTENANCE = 3

export const roomStatusConfig: Record<
  number,
  { key: TranslationKey; dotClass: string }
> = {
  [ROOM_AVAILABLE]: { key: 'statusAvailable', dotClass: 'bg-green-500' },
  [ROOM_OCCUPIED]: { key: 'statusOccupied', dotClass: 'bg-red-500' },
  [ROOM_RESERVED]: { key: 'statusReserved', dotClass: 'bg-amber-500' },
  [ROOM_MAINTENANCE]: { key: 'statusMaintenance', dotClass: 'bg-gray-500' },
}

// ReservationStatus enum values from Rooms.Domain
export const SESSION_RESERVED = 1
export const SESSION_ACTIVE = 2
const SESSION_COMPLETED = 3
export const SESSION_CANCELLED = 4

export const sessionStatusConfig: Record<
  number,
  {
    key: TranslationKey
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
  }
> = {
  [SESSION_RESERVED]: { key: 'statusReserved', variant: 'outline' },
  [SESSION_ACTIVE]: { key: 'statusActive', variant: 'default' },
  [SESSION_COMPLETED]: { key: 'statusCompleted', variant: 'secondary' },
  [SESSION_CANCELLED]: { key: 'cancelled', variant: 'destructive' },
}

export function sessionStartTime(
  session: ReservationViewModel
): string | undefined {
  return session.actualStartTime ?? session.createdAt
}

export function formatDuration(startTime: string, endTime?: string): string {
  const start = new Date(startTime)
  const end = endTime ? new Date(endTime) : new Date()
  const diffMs = Math.max(0, end.getTime() - start.getTime())
  const hours = Math.floor(diffMs / 3_600_000)
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

// The server bills in quarter-hour steps (1.25, 2.5, ...); these read its
// pre-computed values off the session instead of estimating live.
export function formatBillingHours(
  hours: number | string | undefined,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
): string {
  return t('billedHoursFormat', { hours: Number(hours ?? 0) })
}

export function sessionBilledHours(session: ReservationViewModel): number {
  return (
    Number(session.singleRoundedHours ?? 0) +
    Number(session.multiRoundedHours ?? 0)
  )
}
