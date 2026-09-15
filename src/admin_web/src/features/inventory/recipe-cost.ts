import { type CatalogItemDto, type LocalizedText } from '@/api/catalog'
import { type RecipeCostView } from '@/api/inventory'
import { toNumber } from '@/lib/money'
import { resolve } from './recipe-model'

/**
 * What one sale costs depends on what the customer picks. The figure
 * everyone quotes is the cost of the standard choice — the default option
 * of each group — and then what each other choice adds to it. Both are the
 * same resolution the till uses (recipe-model.ts), priced at the branch's
 * average costs the server put on every line.
 */

/** The option ids a sale has when the customer changes nothing */
function standardSelection(item: CatalogItemDto): Set<string> {
  const selected = new Set<string>()
  for (const group of item.customizations ?? []) {
    for (const option of group.options ?? []) {
      if (option.isDefault) selected.add(String(toNumber(option.id)))
    }
  }
  return selected
}

/** The resolved deduction for a selection, priced */
function costOfSelection(
  cost: RecipeCostView,
  selection: ReadonlySet<string>
): number {
  const unitCost = new Map<string, number>()
  for (const line of cost.lines) {
    unitCost.set(String(line.stockItemId), toNumber(line.unitCost))
  }
  let sum = 0
  for (const [stockItemId, quantity] of resolve(cost.lines, selection)) {
    sum += quantity * (unitCost.get(stockItemId) ?? 0)
  }
  return Math.round(sum * 100) / 100
}

/** The cost of the standard choice */
export function standardCost(
  cost: RecipeCostView,
  item: CatalogItemDto
): number {
  return costOfSelection(cost, standardSelection(item))
}

type ChoiceDelta = {
  id: string
  name: LocalizedText | undefined
  isDefault: boolean
  /** What picking this instead of (or on top of) the standard adds; 0 for the standard itself */
  delta: number
}

type GroupDeltas = {
  id: string
  name: LocalizedText | undefined
  allowMultiple: boolean
  options: ChoiceDelta[]
}

/**
 * For each option group the recipe reacts to (an override names one of
 * its options), what every option adds to
 * the standard cost: a single-choice option replaces the group's default,
 * an add-on stacks on top.
 */
export function choiceDeltas(
  cost: RecipeCostView,
  item: CatalogItemDto
): GroupDeltas[] {
  const standard = standardSelection(item)
  const base = costOfSelection(cost, standard)
  const referenced = new Set<string>()
  for (const line of cost.lines) {
    for (const id of line.optionIds) referenced.add(String(toNumber(id)))
  }

  const groups: GroupDeltas[] = []
  for (const group of item.customizations ?? []) {
    const options = group.options ?? []
    if (!options.some((o) => referenced.has(String(toNumber(o.id))))) continue
    const groupIds = new Set(options.map((o) => String(toNumber(o.id))))
    groups.push({
      id: String(toNumber(group.id)),
      name: group.name,
      allowMultiple: !!group.allowMultiple,
      options: options.map((option) => {
        const id = String(toNumber(option.id))
        const selection = new Set(standard)
        if (!group.allowMultiple) {
          for (const other of groupIds) selection.delete(other)
        }
        selection.add(id)
        return {
          id,
          name: option.name,
          isDefault: !!option.isDefault,
          delta:
            Math.round((costOfSelection(cost, selection) - base) * 100) / 100,
        }
      }),
    })
  }
  return groups
}

/** The standard choice, named, for the caption ("فاتح · سادة · سنجل") */
export function standardChoiceNames(
  item: CatalogItemDto,
  localized: (text: LocalizedText | null | undefined) => string
): string[] {
  const names: string[] = []
  for (const group of item.customizations ?? []) {
    if (group.allowMultiple) continue
    const chosen = (group.options ?? []).find((o) => o.isDefault)
    if (chosen) names.push(localized(chosen.name))
  }
  return names
}
