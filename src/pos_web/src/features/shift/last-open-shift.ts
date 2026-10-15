/**
 * The shift last seen open on this till, per branch, kept on the device: a
 * sale rung up with the internet down belongs to the drawer it was paid
 * into, and the replay tells the server which one that was (the shift is not
 * among the queries kept for an offline reload, so it is remembered here).
 */
const KEY = 'pos.lastOpenShift'

export type OpenShifts = Record<string, number>

/** The map after hearing that `branchId`'s open shift is `shiftId` (null: none open) */
export function withOpenShift(
  shifts: OpenShifts,
  branchId: number,
  shiftId: number | null,
): OpenShifts {
  const next = { ...shifts }
  if (shiftId == null) delete next[String(branchId)]
  else next[String(branchId)] = shiftId
  return next
}

function read(): OpenShifts {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    return parsed && typeof parsed === 'object' ? (parsed as OpenShifts) : {}
  } catch {
    return {}
  }
}

export function rememberOpenShift(branchId: number, shiftId: number | null) {
  const current = read()
  if ((current[String(branchId)] ?? null) === shiftId) return
  try {
    localStorage.setItem(KEY, JSON.stringify(withOpenShift(current, branchId, shiftId)))
  } catch {
    // Storage refused: the server puts the sale on the shift open when it arrives
  }
}

/** The shift open on this till at `branchId` when last heard, or null */
export function lastOpenShiftId(branchId: number | null): number | null {
  if (branchId == null) return null
  const id = read()[String(branchId)]
  return typeof id === 'number' && Number.isFinite(id) ? id : null
}
