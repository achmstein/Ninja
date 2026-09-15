import {
  draftKey,
  optionSetKey,
  overrideHasContent,
  type OverrideDraft,
  type RecipeDraft,
  type ScaleDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import {
  type MenuGroup,
  type MenuOption,
  type MenuOptions,
} from './menu-options'

/**
 * The recipe the way the admin describes it, behind the cards of
 * recipe-builder.tsx: for each ingredient, which item (fixed, or a table
 * by the choices that decide it), how much (fixed, or a number per
 * choice) and when (always, or only with some choices). The answers are
 * compiled into the slot draft the till reads (recipe-model.ts) and read
 * back from it. Pure, so both directions are tested without the cards.
 */

type ItemSpec = {
  /** The item when nothing decides it; also the bag the table is guessed from */
  fixed: string | null
  /** The groups that decide the item (at most two); empty = fixed */
  groupIds: string[]
  /** Per combination of those groups' options (optionSetKey) */
  cells: Record<string, string | null>
}

type AmountSpec = {
  fixed: string
  /** The one group that decides the amount; null = fixed */
  groupId: string | null
  /** Per option of that group; '0' = nothing for that choice */
  values: Record<string, string>
}

type WhenSpec = {
  /** The one group whose choices decide whether the ingredient is deducted; null = always */
  groupId: string | null
  /** The options it is deducted for */
  only: string[]
}

export type IngredientSpec = {
  key: number
  item: ItemSpec
  amount: AmountSpec
  when: WhenSpec
}

export type BuilderState = {
  ingredients: IngredientSpec[]
  /** Slots the cards could not express, kept verbatim */
  custom: SlotDraft[]
  /** Size factors from before the cards, kept while a custom slot still grows with them */
  scales: ScaleDraft[]
}

/** What a card picks an item from: the shelf, or an ingredient about to be created */
type ShelfItem = { value: string; names: string[] }

export const newIngredient = (): IngredientSpec => ({
  key: draftKey(),
  item: { fixed: null, groupIds: [], cells: {} },
  amount: { fixed: '', groupId: null, values: {} },
  when: { groupId: null, only: [] },
})

// ---------------------------------------------------------------------------
// Guessing a bag from its name

/** Arabic and Latin names folded to one spelling for matching */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[آأإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Every combination of one option per group, in menu order */
export function combos(groups: MenuGroup[]): MenuOption[][] {
  return groups.reduce<MenuOption[][]>(
    (acc, group) =>
      acc.flatMap((combo) => group.options.map((o) => [...combo, o])),
    [[]]
  )
}

/**
 * The bag for a combination, from the base bag's name: for each group, the
 * option whose name is in the base name is swapped for the wanted one
 * ("بن تركي وسط سادة" → "بن تركي فاتح محوج"); when that exact name is not
 * on the shelf, an item carrying every wanted word and the base's first
 * word will do.
 */
export function guessCell(
  base: ShelfItem,
  combo: MenuOption[],
  groups: MenuGroup[],
  ingredients: ShelfItem[]
): string | null {
  const byName = new Map<string, string>()
  for (const i of ingredients)
    for (const n of i.names) byName.set(fold(n), i.value)

  for (const baseName of base.names) {
    let candidates = [baseName]
    for (const [index, group] of groups.entries()) {
      const wanted = combo[index]
      const present = group.options.find((o) =>
        o.names.some((n) => baseName.includes(n))
      )
      if (!present || present.id === wanted.id) continue
      candidates = candidates.flatMap((c) =>
        present.names
          .filter((f) => c.includes(f))
          .flatMap((f) => wanted.names.map((w) => c.replace(f, w)))
      )
    }
    for (const c of candidates) {
      const hit = byName.get(fold(c))
      if (hit) return hit
    }
  }

  const first = fold(base.names[0] ?? '').split(' ')[0]
  const wanted = combo.map((o) => o.names.map(fold))
  const fallback = ingredients.find((i) =>
    i.names.some((n) => {
      const f = fold(n)
      return (
        (!first || f.includes(first)) &&
        wanted.every((names) => names.some((w) => w && f.includes(w)))
      )
    })
  )
  return fallback?.value ?? null
}

// ---------------------------------------------------------------------------
// Between the cards and the slot draft

/**
 * The option a group counts as when the customer did not touch it, which
 * is what the till sends: the default; for a required single-choice group
 * without one, its first option (what the customer app picks); nothing
 * for an add-on group or an optional group without a default, since such
 * a sale carries no option of the group at all.
 */
const assumed = (group: MenuGroup): MenuOption | undefined =>
  group.allowMultiple
    ? undefined
    : (group.options.find((o) => o.isDefault) ??
      (group.isRequired ? group.options[0] : undefined))

/** The option to hold a group at while reading a card back: its default, else its first */
const representative = (group: MenuGroup): MenuOption =>
  group.options.find((o) => o.isDefault) ?? group.options[0]

/** What one choice makes of an ingredient */
type Cell = { item: string | null; quantity: number; present: boolean }

const NOTHING: Cell = { item: null, quantity: 0, present: false }

/** One option per group, or none where the customer picked nothing */
type Choice = Map<string, MenuOption | undefined>

const choiceOf = (
  groups: MenuGroup[],
  pick: (group: MenuGroup, index: number) => MenuOption | undefined
): Choice => new Map(groups.map((g, i) => [g.id, pick(g, i)] as const))

/** What a card says for a choice; a group left unchosen decides nothing */
function cellFor(spec: IngredientSpec, choice: Choice): Cell {
  let item = spec.item.fixed
  if (spec.item.groupIds.length > 0) {
    const picked = spec.item.groupIds
      .map((id) => choice.get(id))
      .filter((o): o is MenuOption => !!o)
    item =
      picked.length === spec.item.groupIds.length
        ? (spec.item.cells[optionSetKey(picked.map((o) => o.id))] ?? null)
        : null
  }
  let quantity = parseFloat(spec.amount.fixed)
  if (spec.amount.groupId) {
    const picked = choice.get(spec.amount.groupId)
    quantity = picked ? parseFloat(spec.amount.values[picked.id] ?? '') : 0
  }
  let present = true
  if (spec.when.groupId) {
    const picked = choice.get(spec.when.groupId)
    present = !!picked && spec.when.only.includes(picked.id)
  }
  return present && quantity > 0 && item
    ? { item, quantity, present: true }
    : NOTHING
}

/**
 * The answers compiled into slots. An ingredient decided by groups K gets
 * an override for every combination over K and, as the slot's default,
 * the combination the till sends when nothing is touched. An add-on group
 * contributes only the choices the ingredient is deducted for: a sale may
 * carry several of its options at once, and a "nothing" override for a
 * sibling would tie with the add-on's own and win by order.
 */
export function compile(state: BuilderState, menu: MenuOptions): RecipeDraft {
  const slots: SlotDraft[] = []
  for (const spec of state.ingredients) {
    const keyGroupIds = new Set(
      [...spec.item.groupIds, spec.amount.groupId, spec.when.groupId].filter(
        (id): id is string => !!id
      )
    )
    const keyGroups = menu.groups.filter((g) => keyGroupIds.has(g.id))

    if (keyGroups.length === 0) {
      slots.push({
        key: spec.key,
        stockItemId: spec.item.fixed,
        quantity: spec.amount.fixed,
        hasDefault: true,
        scalable: false,
        groupIds: [],
        overrides: [],
      })
      continue
    }

    const addOns = keyGroups.some((g) => g.allowMultiple)
    const base = cellFor(spec, choiceOf(keyGroups, assumed))
    const overrides: OverrideDraft[] = []
    for (const combo of combos(keyGroups)) {
      const cell = cellFor(
        spec,
        choiceOf(keyGroups, (_, i) => combo[i])
      )
      if (addOns && !cell.present) continue
      overrides.push({
        key: draftKey(),
        optionIds: combo.map((o) => o.id),
        stockItemId: cell.item,
        quantity: cell.present ? String(cell.quantity) : '',
        none: !cell.present,
      })
    }
    // A slot without a default is named by the first item its cells mention
    const anchor =
      spec.item.fixed ?? Object.values(spec.item.cells).find((v) => v) ?? null
    if (!base.present && !anchor) continue
    slots.push({
      key: spec.key,
      stockItemId: base.item ?? anchor,
      quantity: base.present ? String(base.quantity) : '',
      hasDefault: base.present,
      scalable: false,
      groupIds: keyGroups.map((g) => g.id),
      overrides,
    })
  }
  // The factors from before the cards stay only while a custom slot grows with them
  const scales = state.custom.some((s) => s.scalable) ? state.scales : []
  return { slots: [...slots, ...state.custom], scales }
}

/**
 * The cards read back from a saved draft: a slot's overrides are complete
 * over some groups K; per group, whether the item, the amount or the
 * presence varies with it says which question it answers. A slot the
 * cards cannot express is kept as a custom rule.
 */
export function reconstruct(
  draft: RecipeDraft,
  menu: MenuOptions
): BuilderState {
  const groupOf = new Map<string, MenuGroup>()
  for (const g of menu.groups) for (const o of g.options) groupOf.set(o.id, g)

  let ingredients: IngredientSpec[] = []
  const custom: SlotDraft[] = []
  for (const slot of draft.slots) {
    const card = readCard(slot, menu, groupOf)
    if (card) ingredients.push(card)
    else custom.push(slot)
  }

  // Size factors from an older recipe become amounts per size on the rows
  // that grew with them
  const sizeGroup =
    draft.scales.length > 0
      ? menu.groups.find((g) =>
          g.options.some((o) => draft.scales.some((s) => s.optionId === o.id))
        )
      : undefined
  if (sizeGroup) {
    const factorOf = (o: MenuOption) => {
      const factor = parseFloat(
        draft.scales.find((s) => s.optionId === o.id)?.factor ?? '1'
      )
      return factor > 0 ? factor : 1
    }
    const kept: IngredientSpec[] = []
    for (const spec of ingredients) {
      const slot = draft.slots.find((s) => s.key === spec.key)
      if (!slot?.scalable) {
        kept.push(spec)
        continue
      }
      if (spec.amount.groupId === sizeGroup.id) {
        // Already a number per size: the factor folds into each
        const values = { ...spec.amount.values }
        for (const o of sizeGroup.options) {
          const quantity = parseFloat(values[o.id] ?? '')
          if (quantity > 0) values[o.id] = String(scaled(quantity, factorOf(o)))
        }
        kept.push({ ...spec, amount: { ...spec.amount, values } })
        continue
      }
      const baseQty = parseFloat(spec.amount.fixed)
      if (spec.amount.groupId || !(baseQty > 0)) {
        // The amount hangs on another group; the cards cannot also grow it
        // with the size, so the row stays a custom rule and keeps its factor
        custom.push(slot)
        continue
      }
      const values: Record<string, string> = {}
      for (const o of sizeGroup.options) {
        values[o.id] = String(scaled(baseQty, factorOf(o)))
      }
      kept.push({
        ...spec,
        amount: { fixed: spec.amount.fixed, groupId: sizeGroup.id, values },
      })
    }
    ingredients = kept
  }

  return { ingredients, custom, scales: draft.scales }
}

const scaled = (quantity: number, factor: number) =>
  Math.round(quantity * factor * 1000) / 1000

/** One card from a slot, or null when the cards cannot say what it says */
function readCard(
  slot: SlotDraft,
  menu: MenuOptions,
  groupOf: Map<string, MenuGroup>
): IngredientSpec | null {
  // An empty cell under an exclusive group means "same as the default" and
  // says nothing; under an add-on group it is what the cards used to write
  // for the add-on's own option, so it still says "only with it"
  const rules = slot.overrides.filter(
    (o) =>
      overrideHasContent(o) ||
      o.optionIds.some((id) => groupOf.get(id)?.allowMultiple)
  )
  if (rules.length === 0) {
    return slot.hasDefault
      ? {
          key: slot.key,
          item: { fixed: slot.stockItemId, groupIds: [], cells: {} },
          amount: { fixed: slot.quantity, groupId: null, values: {} },
          when: { groupId: null, only: [] },
        }
      : null
  }

  const groups = menu.groups.filter((g) =>
    rules.some((o) => o.optionIds.some((id) => groupOf.get(id)?.id === g.id))
  )
  const addOns = groups.filter((g) => g.allowMultiple)
  if (groups.length === 0 || groups.length > 3 || addOns.length > 1) {
    return null
  }

  const cellOf = (o: OverrideDraft): Cell => {
    if (o.none) return NOTHING
    const item = o.stockItemId ?? (slot.hasDefault ? slot.stockItemId : null)
    const quantity = parseFloat(
      o.quantity !== '' ? o.quantity : slot.hasDefault ? slot.quantity : ''
    )
    return item && quantity > 0 ? { item, quantity, present: true } : NOTHING
  }
  const defaultCell: Cell | null = slot.hasDefault
    ? {
        item: slot.stockItemId,
        quantity: parseFloat(slot.quantity),
        present: true,
      }
    : null

  // An add-on group decides presence only: one of its options without a
  // rule is nothing, whatever the default says. A default beside add-on
  // rules is either what the cards used to write (the add-on's own cell
  // again, from when the group's first option counted as the standard
  // choice) or a genuine replacement the cards cannot express.
  if (addOns.length > 0 && defaultCell) {
    const legacy = rules.some((o) => {
      const cell = cellOf(o)
      return (
        cell.present &&
        cell.item === defaultCell.item &&
        cell.quantity === defaultCell.quantity
      )
    })
    if (!legacy) return null
  }
  const fallback = addOns.length > 0 ? NOTHING : defaultCell

  const full = rules.filter(
    (o) =>
      o.optionIds.length === groups.length &&
      groups.every((g) =>
        o.optionIds.some((id) => groupOf.get(id)?.id === g.id)
      )
  )
  const at = (choice: Map<string, string>): Cell | null => {
    const o = full.find((x) =>
      groups.every((g) => x.optionIds.includes(choice.get(g.id)!))
    )
    return o ? cellOf(o) : fallback
  }
  const covered = combos(groups).every(
    (combo) =>
      at(new Map(groups.map((g, i) => [g.id, combo[i].id] as const))) !== null
  )
  if (!covered) return null

  // Read the card at a choice it is deducted for: every group at its
  // default, then the one group presence hangs on moved to an option
  // where it is
  const baseChoice = new Map(
    groups.map((g) => [g.id, representative(g).id] as const)
  )
  if (!at(baseChoice)!.present) {
    const present = groups
      .flatMap((g) => g.options.map((o) => [g, o] as const))
      .find(([g, o]) => at(new Map(baseChoice).set(g.id, o.id))!.present)
    if (!present) return null
    baseChoice.set(present[0].id, present[1].id)
  }

  // Whether what `read` sees changes across the group's options, holding
  // the other groups fixed; a "nothing" cell says nothing about the item
  // or the amount, only about presence
  const varies = (
    g: MenuGroup,
    read: (c: Cell) => unknown,
    presentOnly = false
  ) => {
    const others = groups.filter((x) => x.id !== g.id)
    return combos(others).some((othersCombo) => {
      const choice = new Map(baseChoice)
      others.forEach((x, i) => choice.set(x.id, othersCombo[i].id))
      const seen = new Set<unknown>()
      // An add-on can also be left unticked, and then it is nothing
      if (g.allowMultiple && !presentOnly) seen.add(read(NOTHING))
      for (const o of g.options) {
        choice.set(g.id, o.id)
        const cell = at(choice)!
        if (presentOnly && !cell.present) continue
        seen.add(read(cell))
      }
      return seen.size > 1
    })
  }
  const itemGroups = groups.filter((g) => varies(g, (c) => c.item, true))
  const amountGroups = groups.filter(
    (g) => !itemGroups.includes(g) && varies(g, (c) => c.quantity, true)
  )
  const whenGroups = groups.filter(
    (g) =>
      !itemGroups.includes(g) &&
      !amountGroups.includes(g) &&
      varies(g, (c) => c.present)
  )
  if (
    itemGroups.length > 2 ||
    amountGroups.length > 1 ||
    whenGroups.length > 1 ||
    // The cards decide an item or an amount by exclusive choices only
    [...itemGroups, ...amountGroups].some((g) => g.allowMultiple)
  ) {
    return null
  }

  const cells: Record<string, string | null> = {}
  for (const combo of itemGroups.length > 0 ? combos(itemGroups) : []) {
    const choice = new Map(baseChoice)
    itemGroups.forEach((g, i) => choice.set(g.id, combo[i].id))
    cells[optionSetKey(combo.map((o) => o.id))] = at(choice)!.item
  }
  const values: Record<string, string> = {}
  for (const o of amountGroups[0]?.options ?? []) {
    const choice = new Map(baseChoice)
    choice.set(amountGroups[0].id, o.id)
    values[o.id] = String(at(choice)!.quantity)
  }
  const only: string[] = []
  for (const o of whenGroups[0]?.options ?? []) {
    const choice = new Map(baseChoice)
    choice.set(whenGroups[0].id, o.id)
    if (at(choice)!.present) only.push(o.id)
  }
  const baseCell = at(baseChoice)!
  return {
    key: slot.key,
    item: {
      fixed:
        itemGroups.length > 0
          ? (slot.stockItemId ?? baseCell.item)
          : baseCell.item,
      groupIds: itemGroups.map((g) => g.id),
      cells,
    },
    amount: {
      fixed: String(baseCell.quantity || ''),
      groupId: amountGroups[0]?.id ?? null,
      values,
    },
    when: { groupId: whenGroups[0]?.id ?? null, only },
  }
}
