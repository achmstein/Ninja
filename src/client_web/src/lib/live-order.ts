import { create } from 'zustand'
import { type PillStage } from '@/lib/order-pill'

/**
 * The order the customer is following (components/order-pill.tsx works it
 * out), as the dock shows it: its stage and number while it is worth
 * showing, nothing otherwise.
 */
export const useLiveOrder = create<{ stage: PillStage | null; orderNumber: number | null }>(() => ({
  stage: null,
  orderNumber: null,
}))
