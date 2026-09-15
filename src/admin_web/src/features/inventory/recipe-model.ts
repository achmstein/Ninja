import { type RecipeRequest, type RecipeView } from '@/api/inventory'
import { toNumber } from '@/lib/money'

/**
 * A recipe as slots (inventory-plan.md D6): the things one sale takes,
 * each with a default, overrides the customer's choices trigger, and
 * whether the size factors apply. `resolve` is the TypeScript mirror of
 * Recipe.Explode on the server; the preview and the cost card use it so
 * what they show is what the till will deduct.
 */

/** The line shape a recipe and its costing share */
export type SlotLine = {
  stockItemId: number | string
  quantity: number | string
  optionIds: Array<number | string>
  slot: number | string
  scalable: boolean
  isNone: boolean
}

export type SlotScale = { optionId: number | string; factor: number | string }

/** The product of the chosen options' factors; 1 when none applies */
export function scaleFactor(
  scales: SlotScale[],
  chosen: ReadonlySet<string>
): number {
  let factor = 1
  for (const scale of scales) {
    if (chosen.has(String(scale.optionId))) factor *= toNumber(scale.factor)
  }
  return factor
}

/** The line a slot resolves to: the most specific applicable override, else the default, else nothing */
export function resolveSlot(
  lines: SlotLine[],
  chosen: ReadonlySet<string>
): SlotLine | undefined {
  let best: SlotLine | undefined
  for (const line of lines) {
    if (line.optionIds.length === 0) continue
    if (!line.optionIds.every((id) => chosen.has(String(id)))) continue
    // Ties keep the earlier line, so the saved order decides
    if (!best || line.optionIds.length > best.optionIds.length) best = line
  }
  return best ?? lines.find((line) => line.optionIds.length === 0)
}

/** Lines grouped by slot, in slot order */
export function bySlot(lines: SlotLine[]): Map<string, SlotLine[]> {
  const slots = new Map<string, SlotLine[]>()
  for (const line of [...lines].sort(
    (a, b) => toNumber(a.slot) - toNumber(b.slot)
  )) {
    const key = String(line.slot)
    slots.set(key, [...(slots.get(key) ?? []), line])
  }
  return slots
}

/**
 * What a sale with these options deducts, per stock item — every slot
 * resolved, none overrides skipped, scalable slots multiplied.
 */
export function resolve(
  lines: SlotLine[],
  scales: SlotScale[],
  chosen: ReadonlySet<string>,
  units = 1
): Map<string, number> {
  const factor = scaleFactor(scales, chosen)
  const totals = new Map<string, number>()
  for (const slot of bySlot(lines).values()) {
    const line = resolveSlot(slot, chosen)
    if (!line || line.isNone) continue
    const id = String(line.stockItemId)
    const quantity =
      toNumber(line.quantity) * units * (line.scalable ? factor : 1)
    totals.set(id, (totals.get(id) ?? 0) + quantity)
  }
  return totals
}

// ---------------------------------------------------------------------------
// The editor's draft

export type OverrideDraft = {
  key: number
  /** Every option the override needs chosen */
  optionIds: string[]
  /** null = the slot's default item */
  stockItemId: string | null
  /** '' = the slot's default quantity */
  quantity: string
  /** For these options the slot deducts nothing */
  none: boolean
}

export type SlotDraft = {
  key: number
  stockItemId: string | null
  quantity: string
  /** False: the slot only appears for the choices its overrides name (an add-on) */
  hasDefault: boolean
  scalable: boolean
  /** The option groups the slot depends on, in menu order */
  groupIds: string[]
  overrides: OverrideDraft[]
}

export type ScaleDraft = { optionId: string; factor: string }

export type RecipeDraft = { slots: SlotDraft[]; scales: ScaleDraft[] }

let nextKey = 1
export const draftKey = () => nextKey++

export function newSlot(
  stockItemId: string | null = null,
  quantity = '',
  scalable = true
): SlotDraft {
  return {
    key: draftKey(),
    stockItemId,
    quantity,
    hasDefault: true,
    scalable,
    groupIds: [],
    overrides: [],
  }
}

export const emptyDraft = (): RecipeDraft => ({ slots: [], scales: [] })

/** Order-independent identity of an option set */
export const optionSetKey = (optionIds: readonly string[]) =>
  [...optionIds].sort((a, b) => Number(a) - Number(b)).join('+')

/**
 * A saved recipe as the editor holds it. `groupOf` maps an option id to
 * its group so a slot knows which groups it depends on; overrides naming
 * an option that no longer exists keep it (shown as removed).
 */
export function fromApi(
  recipe: RecipeView | undefined,
  groupOf: (optionId: string) => string | undefined,
  groupOrder: readonly string[]
): RecipeDraft {
  if (!recipe) return emptyDraft()
  const slots: SlotDraft[] = []
  for (const lines of bySlot(recipe.lines).values()) {
    const base = lines.find((l) => l.optionIds.length === 0 && !l.isNone)
    const overrides = lines.filter((l) => l !== base)
    const groups = new Set<string>()
    for (const line of overrides) {
      for (const id of line.optionIds) {
        const group = groupOf(String(id))
        if (group) groups.add(group)
      }
    }
    slots.push({
      key: draftKey(),
      stockItemId: base ? String(base.stockItemId) : null,
      quantity: base ? String(toNumber(base.quantity)) : '',
      hasDefault: !!base,
      scalable: (base ?? lines[0]).scalable,
      groupIds: groupOrder.filter((g) => groups.has(g)),
      overrides: overrides.map((line) => ({
        key: draftKey(),
        optionIds: line.optionIds.map(String),
        stockItemId: line.isNone
          ? null
          : base && String(line.stockItemId) === String(base.stockItemId)
            ? null
            : String(line.stockItemId),
        quantity: line.isNone
          ? ''
          : base && toNumber(line.quantity) === toNumber(base.quantity)
            ? ''
            : String(toNumber(line.quantity)),
        none: line.isNone,
      })),
    })
  }
  return {
    slots,
    scales: recipe.scales.map((s) => ({
      optionId: String(s.optionId),
      factor: String(toNumber(s.factor)),
    })),
  }
}

/** Whether an override cell says anything at all */
export const overrideHasContent = (o: OverrideDraft) =>
  o.none || o.stockItemId !== null || o.quantity.trim() !== ''

/** The line the resolver would see for an override, with the slot's default filled in */
export function overrideLine(
  slot: SlotDraft,
  o: OverrideDraft
): { stockItemId: string | null; quantity: number } {
  return {
    stockItemId: o.stockItemId ?? slot.stockItemId,
    quantity:
      o.quantity.trim() !== ''
        ? parseFloat(o.quantity)
        : parseFloat(slot.quantity),
  }
}

export type DraftProblem =
  | 'recipeNeedsLine'
  | 'recipeLineIncomplete'
  | 'recipeOverrideIncomplete'
  | 'recipeSlotEmpty'
  | 'recipeScaleInvalid'
  | null

/** The first thing wrong with a draft, as a message key; null when it can be saved */
export function validateDraft(draft: RecipeDraft): DraftProblem {
  if (draft.slots.length === 0) return 'recipeNeedsLine'
  for (const slot of draft.slots) {
    const overrides = slot.overrides.filter(overrideHasContent)
    if (slot.hasDefault) {
      if (!slot.stockItemId || !(parseFloat(slot.quantity) > 0)) {
        return 'recipeLineIncomplete'
      }
    } else if (overrides.every((o) => o.none)) {
      return 'recipeSlotEmpty'
    }
    for (const o of overrides) {
      if (o.none) continue
      const line = overrideLine(slot, o)
      if (!line.stockItemId || !(line.quantity > 0)) {
        return 'recipeOverrideIncomplete'
      }
    }
  }
  for (const scale of draft.scales) {
    const factor = parseFloat(scale.factor)
    if (!(factor > 0) || factor > 20) return 'recipeScaleInvalid'
  }
  return null
}

/** The draft as the API takes it: slots numbered 1.., only cells that say something, factors other than 1 */
export function toApi(draft: RecipeDraft): RecipeRequest {
  const lines: RecipeRequest['lines'] = []
  draft.slots.forEach((slot, index) => {
    const number = index + 1
    if (slot.hasDefault) {
      lines.push({
        stockItemId: Number(slot.stockItemId),
        quantity: parseFloat(slot.quantity),
        optionIds: [],
        slot: number,
        scalable: slot.scalable,
        none: false,
      })
    }
    // A none override needs a stock item to name its slot by
    const anchor =
      slot.stockItemId ??
      slot.overrides.find((o) => !o.none && o.stockItemId)?.stockItemId ??
      null
    for (const o of slot.overrides.filter(overrideHasContent)) {
      if (o.none) {
        if (!anchor) continue
        lines.push({
          stockItemId: Number(anchor),
          quantity: 0,
          optionIds: o.optionIds.map(Number),
          slot: number,
          scalable: slot.scalable,
          none: true,
        })
        continue
      }
      const line = overrideLine(slot, o)
      lines.push({
        stockItemId: Number(line.stockItemId),
        quantity: line.quantity,
        optionIds: o.optionIds.map(Number),
        slot: number,
        scalable: slot.scalable,
        none: false,
      })
    }
  })
  return {
    lines,
    scales: draft.scales
      .filter((s) => parseFloat(s.factor) > 0 && parseFloat(s.factor) !== 1)
      .map((s) => ({
        optionId: Number(s.optionId),
        factor: parseFloat(s.factor),
      })),
  }
}

/** The draft as resolvable lines, for the preview while editing */
export function draftLines(draft: RecipeDraft): {
  lines: SlotLine[]
  scales: SlotScale[]
} {
  const request = toApi(draft)
  return {
    lines: request.lines.map((l) => ({
      stockItemId: l.stockItemId,
      quantity: l.quantity,
      optionIds: l.optionIds ?? [],
      slot: l.slot ?? 0,
      scalable: l.scalable ?? true,
      isNone: l.none ?? false,
    })),
    scales: request.scales ?? [],
  }
}

/** One base line of exactly one piece, no overrides, no factors: the "sell as a unit" shape */
export function isUnitDraft(draft: RecipeDraft): boolean {
  return (
    draft.slots.length === 1 &&
    draft.slots[0].hasDefault &&
    draft.slots[0].overrides.length === 0 &&
    parseFloat(draft.slots[0].quantity) === 1 &&
    draft.scales.length === 0
  )
}
