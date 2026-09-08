import type { ReservationViewModel } from '@/api/spaces/types.gen'
import type { useT } from '@/lib/i18n'

type Translate = ReturnType<typeof useT>

// RoomDisplayStatus enum values from Spaces.API — what listRooms returns
export const ROOM_AVAILABLE = 1
export const ROOM_OCCUPIED = 2
export const ROOM_RESERVED = 3
export const ROOM_MAINTENANCE = 4

// ReservationStatus enum values from Spaces.Domain
export const SESSION_RESERVED = 1
export const SESSION_ACTIVE = 2

export type PlayerMode = 'Single' | 'Multi'

/** The one place colour means something on the rooms grid: the room's state. */
export const roomStatusDot: Record<number, string> = {
  [ROOM_AVAILABLE]: 'bg-green-500',
  [ROOM_OCCUPIED]: 'bg-red-500',
  [ROOM_RESERVED]: 'bg-amber-500',
  [ROOM_MAINTENANCE]: 'bg-gray-400',
}

// Branded so a failed guard does not narrow the session away: "not active"
// still leaves "reserved" on the table for the next check
export type ActiveSession = ReservationViewModel & { readonly __state: 'active' }
export type ReservedSession = ReservationViewModel & { readonly __state: 'reserved' }

export function isActive(
  session: ReservationViewModel | null | undefined
): session is ActiveSession {
  return session != null && Number(session.status) === SESSION_ACTIVE
}

export function isReserved(
  session: ReservationViewModel | null | undefined
): session is ReservedSession {
  return session != null && Number(session.status) === SESSION_RESERVED
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

/** Seconds since the session's timer started. */
export function elapsedSeconds(session: ReservationViewModel, nowMs: number): number {
  return session.actualStartTime
    ? (nowMs - new Date(session.actualStartTime).getTime()) / 1000
    : 0
}

/** Seconds spent in one player mode across the session's segments. */
export function modeSeconds(
  session: ReservationViewModel,
  mode: PlayerMode,
  nowMs: number
): number {
  return (session.segments ?? [])
    .filter((segment) => segment.playerMode === mode && segment.startTime)
    .reduce((sum, segment) => {
      const end = segment.endTime ? new Date(segment.endTime).getTime() : nowMs
      return sum + (end - new Date(segment.startTime!).getTime()) / 1000
    }, 0)
}

/**
 * The server's rounding, in the open: minutes to the nearest quarter hour,
 * halves away from zero. Below seven and a half minutes nothing is billed.
 */
export function roundedHours(seconds: number): number {
  const minutes = seconds / 60
  if (minutes <= 0) return 0
  return Math.round(minutes / 15) / 4
}

/**
 * What the session would cost if it ended this second: every segment,
 * the running one included, rounded the way the server rounds when the
 * segment closes, at the room's rate for its mode. The bill only gets the
 * real figure when the session ends; this is the cashier's preview.
 */
export function estimateSessionCost(
  session: ReservationViewModel,
  room: { singleRate?: number | string; multiRate?: number | string },
  nowMs: number
): { singleHours: number; multiHours: number; hours: number; amount: number } {
  const singleHours = roundedHours(modeSeconds(session, 'Single', nowMs))
  const multiHours = roundedHours(modeSeconds(session, 'Multi', nowMs))
  return {
    singleHours,
    multiHours,
    hours: singleHours + multiHours,
    amount:
      singleHours * Number(room.singleRate ?? 0) +
      multiHours * Number(room.multiRate ?? 0),
  }
}

// The server bills in quarter-hour steps (1.25, 2.5, ...) and puts the
// rounded figures on the session once a segment closes; these read them
// rather than estimating
export function sessionBilledHours(session: ReservationViewModel): number {
  return (
    Number(session.singleRoundedHours ?? 0) +
    Number(session.multiRoundedHours ?? 0)
  )
}

export function formatBillingHours(
  hours: number | string | undefined,
  t: Translate
): string {
  return t('billedHoursFormat', { hours: Number(hours ?? 0) })
}

/**
 * The people in the room as the customer picker offers them: everyone on
 * the roster who has an account. A member with no name still shows, as
 * the picker labels the blank.
 */
export function sessionRoster(
  session: ReservationViewModel | null | undefined
): { id: string; name: string }[] {
  return (session?.members ?? [])
    .filter((member) => member.customerId)
    .map((member) => ({
      id: String(member.customerId),
      name: member.customerName ?? '',
    }))
}

export function modeLabel(mode: string | null | undefined, t: Translate): string {
  return mode === 'Multi' ? t('playerModeMulti') : t('playerModeSingle')
}
