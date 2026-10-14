import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// How this PC prints: the Windows printers the print connector on this
// machine sends to. Per PC, not per branch — two counters in one shop have
// two receipt printers — and kept across a refresh. No receipt printer means
// the browser's own print dialog, as before.
type PrintSettingsState = {
  receiptPrinter: string | null
  /** The offline kitchen chit's printer; none prints it with the receipt */
  kitchenPrinter: string | null
  drawerOnCash: boolean
  setReceiptPrinter: (name: string | null) => void
  setKitchenPrinter: (name: string | null) => void
  setDrawerOnCash: (on: boolean) => void
}

export const usePrintSettings = create<PrintSettingsState>()(
  persist(
    (set) => ({
      receiptPrinter: null,
      kitchenPrinter: null,
      drawerOnCash: true,
      setReceiptPrinter: (receiptPrinter) => set({ receiptPrinter }),
      setKitchenPrinter: (kitchenPrinter) => set({ kitchenPrinter }),
      setDrawerOnCash: (drawerOnCash) => set({ drawerOnCash }),
    }),
    { name: 'ninja-pos-printing' },
  ),
)
