import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The call-centre mode of the till: every sale starts from the caller, and
// the active branch follows the branch that makes each order. Kept across a
// refresh; only offered to an account given every branch while the business
// has the call centre (use-call-centre).
type CallCentreState = {
  on: boolean
  setOn: (on: boolean) => void
}

export const useCallCentreStore = create<CallCentreState>()(
  persist(
    (set) => ({
      on: false,
      setOn: (on) => set({ on }),
    }),
    { name: 'ninja-pos-call-centre' },
  ),
)
