import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** The sitting that just ended: what the thanks card says. */
export type PaidVisit = {
  placeName: { en?: string; ar?: string | null }
  receiptNumber: number | null
  /** The customer's own order the bill covered, for the rating on the card;
   *  null when the sitting ended without one of theirs */
  orderId: number | null
  at: number
}

type ThanksState = {
  paid: PaidVisit | null
  setPaid: (visit: Omit<PaidVisit, 'at'>) => void
  clear: () => void
}

/**
 * The bill was paid, so the table card dissolves into thanks
 * (docs/visit-tab.html). It stays until the customer dismisses it or scans
 * their next table — no clock guessing when they stopped caring.
 */
export const useThanksStore = create<ThanksState>()(
  persist(
    (set) => ({
      paid: null,
      setPaid: (visit) => set({ paid: { ...visit, at: Date.now() } }),
      clear: () => set({ paid: null }),
    }),
    { name: 'chillax-thanks' },
  ),
)

export function usePaidVisit(): PaidVisit | null {
  return useThanksStore((s) => s.paid)
}
