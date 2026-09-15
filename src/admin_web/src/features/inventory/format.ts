import { isAxiosError } from 'axios'
import { type Translate, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'

// Wire values for AdjustmentRequest.type: the backend enum has no string
// converter, so the SDK types it as a number (Purchase=0, Sale=1, Waste=2,
// Count=3, Adjustment=4). Only these two may be posted by hand.
export const MOVEMENT_WASTE = 2
export const MOVEMENT_ADJUSTMENT = 4

/** Every MovementType, wire value beside the name the read models spell */
export const MOVEMENT_TYPE_VALUES: { value: number; name: string }[] = [
  { value: 0, name: 'Purchase' },
  { value: 1, name: 'Sale' },
  { value: 2, name: 'Waste' },
  { value: 3, name: 'Count' },
  { value: 4, name: 'Adjustment' },
  { value: 5, name: 'TransferOut' },
  { value: 6, name: 'TransferIn' },
]

// MovementView.type comes back as the enum name
export const movementTypeKeys: Record<string, TranslationKey> = {
  Purchase: 'movementTypePurchase',
  Sale: 'movementTypeSale',
  Waste: 'movementTypeWaste',
  Count: 'movementTypeCount',
  Adjustment: 'movementTypeAdjustment',
  TransferOut: 'movementTypeTransferOut',
  TransferIn: 'movementTypeTransferIn',
}

// The units a café actually stocks in; anything else is typed in
export const UNITS = ['pcs', 'g', 'ml', 'kg', 'l'] as const
export const CUSTOM_UNIT = 'custom'

const quantityFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3,
})

// Unit codes are stored verbatim (the API and other clients rely on them);
// the five built-in ones get a localized label, custom units show as typed.
const unitKeys: Record<string, TranslationKey> = {
  pcs: 'unitPcs',
  g: 'unitG',
  ml: 'unitMl',
  kg: 'unitKg',
  l: 'unitL',
}

/** Display label for a stock unit code: "pcs" → "قطعة", "Sachet" → "Sachet" */
export function unitLabel(
  unit: string | null | undefined,
  t: Translate
): string {
  const raw = (unit ?? '').trim()
  const key = unitKeys[raw.toLowerCase()]
  return key ? t(key) : raw
}

/** "250 g", "1.5 L" — quantities are decimals in the item's base unit */
export function formatQuantity(
  value: number | string | null | undefined,
  unit: string,
  t: Translate
): string {
  return `${quantityFormat.format(toNumber(value))} ${unitLabel(unit, t)}`
}

/** Same, with an explicit sign for ledger rows: "+250 g", "−1.5 L" */
export function formatSignedQuantity(
  value: number | string | null | undefined,
  unit: string,
  t: Translate
): string {
  const n = toNumber(value)
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${quantityFormat.format(Math.abs(n))} ${unitLabel(unit, t)}`
}

/** Whole-ish packs a base quantity makes, or null for items sold loose */
export function packsOf(
  quantity: number | string | null | undefined,
  packSize: number | string | null | undefined
): number | null {
  const size = toNumber(packSize)
  if (size <= 0) return null
  return Math.round((toNumber(quantity) / size) * 10) / 10
}

// Inventory.API answers domain rule violations (a retired item, a count that
// would go negative, a recipe on an unknown item) with a 400 and the message
// as a plain string body — worth showing verbatim over a generic failure.
export function domainMessage(error: unknown, fallback: string): string {
  if (
    isAxiosError(error) &&
    error.response?.status === 400 &&
    typeof error.response.data === 'string' &&
    error.response.data.trim() !== ''
  ) {
    return error.response.data
  }
  return fallback
}

const referenceKeys: Record<string, TranslationKey> = {
  order: 'referenceOrder',
  purchase: 'referencePurchase',
  count: 'referenceCount',
  transfer: 'referenceTransfer',
}

/** "order:101" → "Order #101" (or the raw text for anything unknown) */
export function referenceLabel(
  reference: string | null | undefined,
  t: Translate
): string {
  if (!reference) return ''
  const [kind, id] = reference.split(':')
  const key = referenceKeys[kind]
  return key && id ? t(key, { id }) : reference
}

/** Movements posted by the sale handler carry the literal actor "system" */
export function actorLabel(
  actor: string | null | undefined,
  t: Translate
): string {
  return actor === 'system' ? t('systemActor') : (actor ?? '')
}

/** A cost this far from the last receipt's is worth a look (the server's ReceiptProposalValidator uses the same) */
const PRICE_CHANGE_THRESHOLD = 10

/**
 * How a unit cost moved against the last one, as a rounded percent, and
 * whether it moved enough to flag; null until both numbers are there.
 */
export function costChange(
  unitCost: number,
  lastCost: number | null | undefined
): { percent: number; flagged: boolean } | null {
  if (!lastCost || lastCost <= 0 || !(unitCost > 0)) return null
  const percent = Math.round(((unitCost - lastCost) / lastCost) * 100)
  return { percent, flagged: Math.abs(percent) >= PRICE_CHANGE_THRESHOLD }
}
