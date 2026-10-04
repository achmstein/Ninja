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

type DeliveryState = {
  /** The customer chose to have it brought (rather than collect it), where the branch delivers */
  wanted: boolean
  /** The address the next order goes to; a guest's last one is remembered here, on the device */
  address: DeliveryAddress | null
  setWanted: (wanted: boolean) => void
  setAddress: (address: DeliveryAddress | null) => void
}

/**
 * The customer's delivery choice, kept on the device: whether they want it
 * brought and where to. A guest's address lives only here; a signed-in
 * customer's are saved on their account too (lib/delivery.ts).
 */
export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set) => ({
      wanted: true,
      address: null,
      setWanted: (wanted) => set({ wanted }),
      setAddress: (address) => set({ address }),
    }),
    { name: 'ninja-delivery' }
  )
)
