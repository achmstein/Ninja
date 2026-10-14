import { translate } from '@/lib/i18n'
import { toast } from '@/lib/toast'
import { connectorStatus, openDrawer, printImage } from './connector'
import { usePrintSettings } from './print-settings'
import { sheetImage } from './sheet-image'

/** The sheets the print stylesheet would print, in page order */
function sheetsOnThePage(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.receipt-sheet'))
}

/**
 * Prints what is on the page to print — the receipt, and offline the
 * kitchen's chit (.kitchen-chit) — straight to this PC's printers through
 * its print connector: no dialog, and the drawer opens with a cash receipt.
 * A PC with no receipt printer chosen, or no connector answering, gets the
 * browser's print dialog as before; so does any print the connector fails,
 * so a receipt is never lost.
 */
export async function printSheets({ kickDrawer = false }: { kickDrawer?: boolean } = {}) {
  const { receiptPrinter, kitchenPrinter, drawerOnCash } = usePrintSettings.getState()
  if (!receiptPrinter || !(await connectorStatus())) {
    window.print()
    return
  }

  let kick = kickDrawer && drawerOnCash
  try {
    for (const sheet of sheetsOnThePage()) {
      const isChit = sheet.classList.contains('kitchen-chit')
      const printer = isChit ? (kitchenPrinter ?? receiptPrinter) : receiptPrinter
      const withKick = kick && !isChit
      await printImage(printer, await sheetImage(sheet), withKick)
      if (withKick) kick = false
    }
  } catch (error) {
    toast.error(translate('printConnectorFailed'), {
      description: error instanceof Error ? error.message : undefined,
    })
    window.print()
  }
}

/**
 * Opens the drawer for cash taken, through the receipt printer it hangs
 * off. Quiet when this PC has no connector or printer, or it can't be
 * reached: the cashier opens it with the key, as before.
 */
export async function openCashDrawer() {
  const { receiptPrinter, drawerOnCash } = usePrintSettings.getState()
  if (!receiptPrinter || !drawerOnCash) return
  try {
    await openDrawer(receiptPrinter)
  } catch {
    // no drawer to open from here
  }
}

/** Whether any of the payments is cash: what opens the drawer */
export const takesCash = (payments: readonly { tender: number }[]) =>
  payments.some((p) => p.tender === 0)
