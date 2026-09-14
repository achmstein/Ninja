import {
  type ProposedLine,
  type ReceiptProposal,
  type StockItemView,
} from '@/api/inventory'
import { toNumber } from '@/lib/money'
import { type Line, money, newLine, perUnit } from './lines'

/**
 * A proposed line as the review sheet edits it: included or not, matched
 * to an item or about to be created, with the amounts as strings the same
 * way the receive form keeps them.
 */
export type ReviewLine = {
  key: number
  proposal: ProposedLine
  include: boolean
  stockItemId: string | null
  /** When set the line creates this item on confirm instead of matching one */
  newItem: {
    nameEn: string
    nameAr: string
    unit: string
    packSize: string
    packName: string
  } | null
  quantity: string
  packs: string
  unitCost: string
  total: string
  priced: 'unit' | 'total'
  /** Filled once the item was created, so a retry after a failure never creates it twice */
  createdId: number | null
}

export function toReviewLines(proposal: ReceiptProposal): ReviewLine[] {
  return proposal.lines.map((line) => {
    const quantity = toNumber(line.quantity)
    const unitCost = toNumber(line.unitCost)
    const total = toNumber(line.lineTotal)
    const packs = line.packs == null ? 0 : toNumber(line.packs)
    return {
      key: newLine().key,
      proposal: line,
      include: true,
      stockItemId: line.stockItemId != null ? String(line.stockItemId) : null,
      newItem:
        line.stockItemId == null && line.newItem
          ? {
              nameEn: line.newItem.name.en ?? '',
              nameAr: line.newItem.name.ar ?? '',
              unit: line.newItem.unit,
              packSize:
                line.newItem.packSize != null
                  ? String(toNumber(line.newItem.packSize))
                  : '',
              packName: line.newItem.packName ?? '',
            }
          : null,
      quantity: quantity > 0 ? String(quantity) : '',
      packs: packs > 0 ? String(packs) : '',
      unitCost: unitCost > 0 ? perUnit(unitCost) : '',
      total: total > 0 ? money(total) : '',
      // The receipt prints totals; the unit cost is derived from them
      priced: 'total',
      createdId: null,
    }
  })
}

/** How sure the assistant was, in four steps the badge can show */
export function confidenceLevel(
  line: ReviewLine
): 'high' | 'medium' | 'low' | 'none' {
  if (!line.stockItemId) return 'none'
  const confidence = toNumber(line.proposal.confidence)
  if (confidence >= 0.8) return 'high'
  if (confidence >= 0.5) return 'medium'
  return 'low'
}

/** A review line is ready when it has (or will have) an item and a quantity */
export function isReviewLineReady(line: ReviewLine): boolean {
  const hasItem = !!line.stockItemId || !!line.newItem?.nameEn.trim()
  return hasItem && parseFloat(line.quantity) > 0 && line.unitCost !== ''
}

/** The receive form's line for a reviewed one, once its item id is known */
export function toReceiveLine(line: ReviewLine, stockItemId: number): Line {
  return {
    key: line.key,
    stockItemId: String(stockItemId),
    quantity: line.quantity,
    packs: line.packs,
    unitCost: line.unitCost,
    total: line.total,
    priced: line.priced,
  }
}

/** The stock item the line points at, when it points at an existing one */
export function matchedItem(
  line: ReviewLine,
  itemById: Map<string, StockItemView>
): StockItemView | undefined {
  return line.stockItemId ? itemById.get(line.stockItemId) : undefined
}
