import { type StockItemView, type StockLevelView } from '@/api/inventory'
import {
  getStockItemsOptions,
  getStockLevelsOptions,
} from '@/api/inventory/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { type Translate } from '@/lib/i18n'
import { type ComboboxOption } from '@/components/combobox'
import { unitLabel } from './format'

// The two lists every inventory screen reaches for: the global item
// catalogue and the active branch's levels (which follow X-Branch-Id).
export const stockItemsQueryOptions = (includeInactive = false) =>
  getStockItemsOptions({
    query: { 'api-version': API_VERSION, includeInactive },
  })

export const stockLevelsQueryOptions = (options?: {
  low?: boolean
  includeRetired?: boolean
}) =>
  getStockLevelsOptions({
    query: {
      'api-version': API_VERSION,
      low: options?.low || undefined,
      includeRetired: options?.includeRetired || undefined,
    },
  })

type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

/** Combobox rows for a stock item picker, unit as the hint */
export function toStockItemOptions(
  items: Array<StockItemView | StockLevelView>,
  localized: Localized,
  t: Translate
): ComboboxOption[] {
  return items.map((item) => ({
    value: String('stockItemId' in item ? item.stockItemId : item.id),
    label: localized(item.name),
    hint: unitLabel(item.unit, t),
  }))
}
