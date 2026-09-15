import { type CatalogItemDto, type LocalizedText } from '@/api/catalog'
import { type RecipeCostView } from '@/api/inventory'
import { toNumber } from '@/lib/money'

/**
 * What one sale costs depends on what the customer picks: a recipe line
 * tied to options counts only when every one of them is chosen. The
 * figure everyone quotes is the cost of the standard choice — the default
 * option of each group — and then what each other choice adds to it.
 */

/** The option ids a sale has when the customer changes nothing */
export function standardSelection(item: CatalogItemDto): Set<number> {
  const selected = new Set<number>()
  for (const group of item.customizations ?? []) {
    for (const option of group.options ?? []) {
      if (option.isDefault) selected.add(toNumber(option.id))
    }
  }
  return selected
}

/** The lines that apply to a selection, summed */
export function costOfSelection(
  cost: RecipeCostView,
  selection: Set<number>
): number {
  let sum = 0
  for (const line of cost.lines) {
    if (line.optionIds.every((id) => selection.has(toNumber(id)))) {
      sum += toNumber(line.cost)
    }
  }
  return Math.round(sum * 100) / 100
}

/** The cost of the standard choice: base lines plus the lines the defaults trigger */
export function standardCost(
  cost: RecipeCostView,
  item: CatalogItemDto
): number {
  return costOfSelection(cost, standardSelection(item))
}

export type ChoiceDelta = {
  id: number
  name: LocalizedText | undefined
  isDefault: boolean
  /** What picking this instead of (or on top of) the standard adds; 0 for the standard itself */
  delta: number
}

export type GroupDeltas = {
  id: number
  name: LocalizedText | undefined
  allowMultiple: boolean
  options: ChoiceDelta[]
}

/**
 * For each option group the recipe reacts to, what every option adds to
 * the standard cost: a single-choice option replaces the group's default,
 * an add-on stacks on top.
 */
export function choiceDeltas(
  cost: RecipeCostView,
  item: CatalogItemDto
): GroupDeltas[] {
  const standard = standardSelection(item)
  const base = costOfSelection(cost, standard)
  const referenced = new Set<number>()
  for (const line of cost.lines) {
    for (const id of line.optionIds) referenced.add(toNumber(id))
  }

  const groups: GroupDeltas[] = []
  for (const group of item.customizations ?? []) {
    const options = group.options ?? []
    if (!options.some((o) => referenced.has(toNumber(o.id)))) continue
    const groupIds = new Set(options.map((o) => toNumber(o.id)))
    groups.push({
      id: toNumber(group.id),
      name: group.name,
      allowMultiple: !!group.allowMultiple,
      options: options.map((option) => {
        const id = toNumber(option.id)
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
