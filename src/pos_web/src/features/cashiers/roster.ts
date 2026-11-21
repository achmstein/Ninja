/*
 * Who can take over this till. A cashier switches by tapping their name on
 * the signed-out screen and typing their PIN on Keycloak's own page (the
 * till names them to Keycloak; nothing about the PIN is ever here). By then
 * nobody is signed in to ask the server who works here, so the till keeps
 * the names from the last time somebody was: first names and sign-in names
 * of the branch's till staff, nothing else.
 */

export type Cashier = {
  /** What Keycloak knows them by (their email): the name the till gives it */
  username: string
  /** What the tile says */
  name: string
}

export type StaffUser = {
  username?: string | null
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  realmRoles?: string[]
  branches?: number[]
  allBranches?: boolean
}

export const ROSTER_KEY = 'ninja-pos-cashiers'
/** Who was tapped on the signed-out screen, checked against who came back signed in */
const PICKED_KEY = 'ninja-pos-picked-cashier'

/** The till staff who work at the branch (owners work at every one), by name */
export function cashiersOf(staff: StaffUser[], branchId: number | null): Cashier[] {
  return staff
    .filter(
      (user) =>
        user.allBranches ||
        (user.realmRoles ?? []).includes('Owner') ||
        (branchId != null && (user.branches ?? []).includes(branchId)),
    )
    .flatMap((user) => {
      const username = (user.username || user.email || '').trim()
      if (!username) return []
      const name = (user.firstName || '').trim() || [user.lastName].filter(Boolean).join(' ') || username
      return [{ username, name }]
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readCashierRoster(): Cashier[] {
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? parsed.filter(
          (c): c is Cashier =>
            typeof c?.username === 'string' && typeof c?.name === 'string',
        )
      : []
  } catch {
    return []
  }
}

export function rememberPickedCashier(username: string | null) {
  try {
    if (username) sessionStorage.setItem(PICKED_KEY, username)
    else sessionStorage.removeItem(PICKED_KEY)
  } catch {
    // Without it the check below is skipped
  }
}

/**
 * Whether the person who came back signed in is the one who was tapped.
 * They are not when the browser still held someone else's Keycloak session:
 * Keycloak then signs that person in without asking anything. The caller
 * signs them out, so the till is never handed to the wrong name.
 */
export function pickedSomeoneElse(signedIn: { preferred_username?: string; email?: string } | undefined): boolean {
  let picked: string | null = null
  try {
    picked = sessionStorage.getItem(PICKED_KEY)
    sessionStorage.removeItem(PICKED_KEY)
  } catch {
    return false
  }
  return isSomeoneElse(picked, signedIn)
}

export function isSomeoneElse(
  picked: string | null,
  signedIn: { preferred_username?: string; email?: string } | undefined,
): boolean {
  if (!picked || !signedIn) return false
  const wanted = picked.trim().toLowerCase()
  return ![signedIn.preferred_username, signedIn.email].some(
    (name) => name?.trim().toLowerCase() === wanted,
  )
}
