import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Where a delivery goes: the pin and the words that find the door, as the customer gave them */
export type DeliveryAddress = {
  /** The saved address it came from, for a signed-in customer; none for a guest's or a one-off */
  id?: number
  label?: string | null
  latitude: number
  longitude: number
  address: string
  building?: string | null
  floor?: string | null
  apartment?: string | null
  directions?: string | null
  phone?: string | null
}

/** Whose choice this is: the signed-in account's subject, or the guest on this device */
export const GUEST_OWNER = 'guest'

type DeliveryState = {
  /** The customer chose to have it brought (rather than collect it), where the branch delivers */
  wanted: boolean
  /** The address the next order goes to; a guest's last one is remembered here, on the device */
  address: DeliveryAddress | null
  /** Who chose it: an address never outlives a sign-out or follows another account on the same device */
  owner: string | null
  setWanted: (wanted: boolean) => void
  setAddress: (address: DeliveryAddress | null) => void
  /** The device is now `owner`'s: someone else's address (and choice) goes */
  claim: (owner: string) => void
}

/**
 * The customer's delivery choice, kept on the device: whether they want it
 * brought and where to. A guest's address lives only here; a signed-in
 * customer's are saved on their account too (lib/delivery.ts). It belongs to
 * whoever chose it: signing out, or another account signing in, starts clean.
 */
export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      wanted: true,
      address: null,
      owner: null,
      setWanted: (wanted) => set({ wanted }),
      setAddress: (address) => set({ address }),
      claim: (owner) => set((s) => (s.owner === owner ? {} : { owner, address: null, wanted: true })),
    }),
    { name: 'ninja-delivery' },
  ),
)
