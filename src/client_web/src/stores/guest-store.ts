import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Identity for a customer who orders without an account.
 *
 * The id is generated in this browser and never leaves it except as the
 * X-Guest-Id header, which is what ties a guest to the orders they placed —
 * so it is a secret, not a public identifier. It is minted at the first guest
 * checkout rather than on arrival: someone who only browses stays untagged.
 *
 * Clearing site data loses the id, and with it the order list. That is the
 * honest trade for not asking anyone to sign up, and why the app still nudges
 * guests towards an account.
 */

export type GuestContact = {
  name: string
  phone: string
}

type GuestState = {
  guestId: string | null
  /** Remembered from the last guest checkout so a regular never retypes it. */
  contact: GuestContact | null
  /** Mints the id on first use and returns it. */
  ensureGuestId: () => string
  setContact: (contact: GuestContact) => void
  /** Drops the guest identity — used when a guest signs in. */
  clear: () => void
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      guestId: null,
      contact: null,
      ensureGuestId: () => {
        const existing = get().guestId
        if (existing) return existing
        const guestId = crypto.randomUUID()
        set({ guestId })
        return guestId
      },
      setContact: (contact) => set({ contact }),
      clear: () => set({ guestId: null, contact: null }),
    }),
    { name: 'chillax-guest' }
  )
)

/** For code outside the React tree (the axios interceptor). */
export function getGuestId(): string | null {
  return useGuestStore.getState().guestId
}
