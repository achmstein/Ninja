import {
  type CashierTotal,
  type ItemTotal,
  type LocalizedText,
} from '@/api/sales'
import { type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

export type ItemRow = {
  key: string
  catalogItemId: number | null
  description: LocalizedText
  /** What customers paid for it, its share of each bill after the bill discount, service and VAT, less refunds */
  amount: number
  /** Units sold less units refunded */
  qty: number
  refundedQty: number
  refundedAmount: number
}

/**
 * The breakdown's items in the money of net sales: the paid share less what
 * was refunded (older servers send only `amount` and `qty`), most first.
 */
export function itemRows(items: ItemTotal[] | undefined): ItemRow[] {
  return (items ?? [])
    .map((item, index) => {
      const refundedQty = toNumber(item.refundedQty)
      const refundedAmount = toNumber(item.refundedAmount)
      return {
        key:
          item.catalogItemId != null
            ? `item-${item.catalogItemId}`
            : `line-${index}`,
        catalogItemId:
          item.catalogItemId != null ? toNumber(item.catalogItemId) : null,
        description: item.description,
        amount:
          item.netAmount != null
            ? toNumber(item.netAmount)
            : toNumber(item.amount) - refundedAmount,
        qty:
          item.netQty != null
            ? toNumber(item.netQty)
            : toNumber(item.qty) - refundedQty,
        refundedQty,
        refundedAmount,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export type CategoryRow = {
  /** The category's id, null for lines no menu category claims */
  id: number | null
  name: LocalizedText | undefined
  amount: number
  qty: number
  refundedQty: number
}

/**
 * Items grouped by their menu category's id (not its name, which reads
 * differently in each language and can repeat). An item no longer on the
 * menu, or a line with no item, counts as uncategorised.
 */
export function categoryRows(
  items: ItemRow[],
  catalog:
    | {
        id?: number | string
        catalogTypeId?: number | string | null
        catalogTypeName?: LocalizedText | null
      }[]
    | undefined
): CategoryRow[] {
  const categoryOf = new Map<
    number,
    { id: number; name: LocalizedText | undefined }
  >()
  for (const item of catalog ?? []) {
    if (item.id == null || item.catalogTypeId == null) continue
    categoryOf.set(toNumber(item.id), {
      id: toNumber(item.catalogTypeId),
      name: item.catalogTypeName ?? undefined,
    })
  }
  const groups = new Map<string, CategoryRow>()
  for (const row of items) {
    const category =
      row.catalogItemId != null ? categoryOf.get(row.catalogItemId) : undefined
    const key = category ? String(category.id) : 'none'
    const group = groups.get(key) ?? {
      id: category?.id ?? null,
      name: category?.name,
      amount: 0,
      qty: 0,
      refundedQty: 0,
    }
    group.amount += row.amount
    group.qty += row.qty
    group.refundedQty += row.refundedQty
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount)
}

/** What a name on the cashier list stands for, when it is not a person. */
export const cashierKindKey: Record<string, TranslationKey> = {
  Platform: 'cashierKindPlatform',
  Online: 'cashierKindOnline',
  Rider: 'cashierKindRider',
  Automatic: 'cashierKindAutomatic',
}

/** A cashier's net sales (gross less their refunds); older servers only send gross as `net`. */
export function cashierNetSales(row: CashierTotal): number {
  return row.netSales != null
    ? toNumber(row.netSales)
    : toNumber(row.net) - toNumber(row.refunds)
}
