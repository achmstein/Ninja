import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getPayAheadOptionsOptions } from '@/api/sales/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import type { OrderDestination } from '@/lib/order-destination'
import { guestFee, num } from '@/lib/pay'

/**
 * Paying ahead online: an order brought to the door or collected at the
 * counter can be paid by card or wallet as it is placed, the till seeing it
 * only once it is paid. Where the business takes it (Sales says so, with the
 * fee a guest would carry), the order asks Online or Cash; the last answer is
 * kept on the device. An order for a table or a room is paid on its bill, never
 * ahead.
 */

export type PayMethod = 'online' | 'cash'

type PayChoiceState = {
  method: PayMethod
  setMethod: (method: PayMethod) => void
}

/** The customer's last answer, kept for the next order; online until they say otherwise */
export const usePayChoice = create<PayChoiceState>()(
  persist(
    (set) => ({
      method: 'online',
      setMethod: (method) => set({ method }),
    }),
    { name: 'ninja-pay-choice' }
  )
)

export type PayAhead = {
  /** The order may be paid ahead here: it goes to a door or the counter, and the business takes it */
  offered: boolean
  /** It will be: offered, and the customer chose to */
  online: boolean
  setMethod: (method: PayMethod) => void
  /** What the card or wallet is charged over an order of that total, the guest carrying the fee; 0 when the business does */
  feeFor: (total: number) => number
  /** A card is only held at the checkout and charged when the branch accepts the order */
  holdsCards: boolean
  /** A demo business: pretend money */
  simulated: boolean
}

/** The fee on top of an order paid ahead, as Sales will work it out */
export function payAheadFee(total: number, options: { feeMode?: string; feePercent?: number | string; feeFixed?: number | string } | undefined): number {
  if (!options || options.feeMode !== 'Guest') return 0
  return guestFee(total, num(options.feePercent), num(options.feeFixed))
}

/** Whether, and how, the order being made is paid ahead */
export function usePayAhead(destination: OrderDestination): PayAhead {
  const method = usePayChoice((s) => s.method)
  const setMethod = usePayChoice((s) => s.setMethod)
  const forDoorOrCounter = !destination
  const query = useQuery({
    ...getPayAheadOptionsOptions({ query: { 'api-version': API_VERSION } }),
    enabled: forDoorOrCounter,
    staleTime: 5 * 60_000,
  })
  const options = query.data
  const offered = forDoorOrCounter && options?.available === true
  const online = offered && method === 'online'
  return {
    offered,
    online,
    setMethod,
    feeFor: (total) => (online ? payAheadFee(total, options) : 0),
    holdsCards: options?.holdsCards === true,
    simulated: options?.simulated === true,
  }
}
