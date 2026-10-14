import { beforeEach, describe, expect, it, vi } from 'vitest'

const connector = vi.hoisted(() => ({
  connectorStatus: vi.fn(),
  printImage: vi.fn(),
  openDrawer: vi.fn(),
}))
vi.mock('./connector', () => connector)
vi.mock('./sheet-image', () => ({
  sheetImage: vi.fn(async (sheet: { id: string }) => `png:${sheet.id}`),
}))
const toastError = vi.hoisted(() => vi.fn())
vi.mock('@/lib/toast', () => ({ toast: { error: toastError } }))
vi.mock('@/lib/i18n', () => ({ translate: (key: string) => key }))

import { openCashDrawer, printSheets, takesCash } from './print-sheets'
import { usePrintSettings } from './print-settings'

const sheet = (id: string, chit = false) => ({
  id,
  classList: { contains: (name: string) => chit && name === 'kitchen-chit' },
})

let sheets: ReturnType<typeof sheet>[] = []
const print = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  sheets = [sheet('receipt'), sheet('chit', true)]
  vi.stubGlobal('document', { querySelectorAll: () => sheets })
  vi.stubGlobal('window', { print })
  connector.connectorStatus.mockResolvedValue({ name: 'COUNTER', version: '1.0.9', printers: ['EPSON', 'KITCHEN'] })
  connector.printImage.mockResolvedValue(undefined)
  connector.openDrawer.mockResolvedValue(undefined)
  usePrintSettings.setState({ receiptPrinter: 'EPSON', kitchenPrinter: 'KITCHEN', drawerOnCash: true })
})

describe('printSheets', () => {
  it('sends the receipt to the receipt printer and the chit to the kitchen, no dialog', async () => {
    await printSheets({ kickDrawer: true })

    expect(connector.printImage.mock.calls).toEqual([
      ['EPSON', 'png:receipt', true],
      ['KITCHEN', 'png:chit', false],
    ])
    expect(print).not.toHaveBeenCalled()
  })

  it('prints the chit with the receipt when the PC has no kitchen printer', async () => {
    usePrintSettings.setState({ kitchenPrinter: null })

    await printSheets()

    expect(connector.printImage.mock.calls.map((c) => c[0])).toEqual(['EPSON', 'EPSON'])
  })

  it('opens the drawer once, and only when this PC opens it for cash', async () => {
    sheets = [sheet('one'), sheet('two')]
    await printSheets({ kickDrawer: true })
    expect(connector.printImage.mock.calls.map((c) => c[2])).toEqual([true, false])

    connector.printImage.mockClear()
    usePrintSettings.setState({ drawerOnCash: false })
    await printSheets({ kickDrawer: true })
    expect(connector.printImage.mock.calls.map((c) => c[2])).toEqual([false, false])
  })

  it('opens the print dialog when no receipt printer is chosen', async () => {
    usePrintSettings.setState({ receiptPrinter: null })

    await printSheets()

    expect(print).toHaveBeenCalledOnce()
    expect(connector.connectorStatus).not.toHaveBeenCalled()
  })

  it('opens the print dialog when no connector answers on this PC', async () => {
    connector.connectorStatus.mockResolvedValue(null)

    await printSheets()

    expect(print).toHaveBeenCalledOnce()
    expect(connector.printImage).not.toHaveBeenCalled()
  })

  it('never loses a receipt: a failed print says so and opens the dialog', async () => {
    connector.printImage.mockRejectedValue(new Error('printer EPSON not found'))

    await printSheets()

    expect(toastError).toHaveBeenCalledWith('printConnectorFailed', { description: 'printer EPSON not found' })
    expect(print).toHaveBeenCalledOnce()
  })
})

describe('openCashDrawer', () => {
  it('opens it through the receipt printer', async () => {
    await openCashDrawer()
    expect(connector.openDrawer).toHaveBeenCalledWith('EPSON')
  })

  it('is quiet with no printer, the switch off, or a connector that fails', async () => {
    usePrintSettings.setState({ receiptPrinter: null })
    await openCashDrawer()
    usePrintSettings.setState({ receiptPrinter: 'EPSON', drawerOnCash: false })
    await openCashDrawer()
    expect(connector.openDrawer).not.toHaveBeenCalled()

    usePrintSettings.setState({ drawerOnCash: true })
    connector.openDrawer.mockRejectedValue(new Error('offline'))
    await expect(openCashDrawer()).resolves.toBeUndefined()
  })
})

describe('takesCash', () => {
  it('is any cash among the payments', () => {
    expect(takesCash([{ tender: 1 }, { tender: 0 }])).toBe(true)
    expect(takesCash([{ tender: 1 }, { tender: 2 }])).toBe(false)
    expect(takesCash([])).toBe(false)
  })
})
