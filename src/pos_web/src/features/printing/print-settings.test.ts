import { beforeAll, describe, expect, it, vi } from 'vitest'

// The store keeps itself in localStorage; the tests run in node
const stored = new Map<string, string>()
beforeAll(() => {
  const localStorage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('window', { localStorage })
})

describe('print settings', () => {
  it('start with the print dialog and the drawer opening for cash', async () => {
    const { usePrintSettings } = await import('./print-settings')
    const state = usePrintSettings.getState()

    expect(state.receiptPrinter).toBeNull()
    expect(state.kitchenPrinter).toBeNull()
    expect(state.drawerOnCash).toBe(true)
  })

  it("are kept for this PC under the till's key", async () => {
    const { usePrintSettings } = await import('./print-settings')

    usePrintSettings.getState().setReceiptPrinter('EPSON TM-T20')
    usePrintSettings.getState().setKitchenPrinter('KITCHEN')
    usePrintSettings.getState().setDrawerOnCash(false)

    expect(JSON.parse(stored.get('ninja-pos-printing')!).state).toEqual({
      receiptPrinter: 'EPSON TM-T20',
      kitchenPrinter: 'KITCHEN',
      drawerOnCash: false,
    })
  })
})
