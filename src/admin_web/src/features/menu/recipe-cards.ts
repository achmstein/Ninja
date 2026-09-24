import {
  draftKey,
  optionSetKey,
  type OverrideDraft,
  type RecipeDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import {
  type MenuGroup,
  type MenuOption,
  type MenuOptions,
} from './menu-options'

/**
 * The recipe the way the admin describes it, behind the cards of
 * recipe-builder.tsx: per ingredient just two answers — which item, and
 * how much — each either one value or one value per combination of the
 * choices it was *split* by. Presence is not a third question: an amount
 * of nothing for a choice is how an ingredient disappears (سادة takes no
 * sugar). Splitting is the only verb, so the admin only ever sees the
 * combinations they asked for. The answers are compiled into the slot
 * draft the till reads (recipe-model.ts) and read back from it. Pure, so
 * both directions are tested without the cards.
 */

/** One value, or one per combination of `groupIds`' options */
export type Varying<T> = {
  /** The groups it is split by, in menu order; empty = a single value */
  groupIds: string[]
  /** optionSetKey of one option per group -> the value; the key is ONE when not split */
  cells: Record<string, T>
}

export type IngredientSpec = {
  key: number
  /** Which stock item; null in a cell the shelf has nothing for */
  item: Varying<string | null>
  /** How much, in the item's base unit; '' or '0' is nothing for that choice */
  amount: Varying<string>
}

export type BuilderState = {
  ingredients: IngredientSpec[]
  /** Slots the cards could not express, kept verbatim */
  custom: SlotDraft[]
}

/** What a card picks an item from: the shelf, or an ingredient about to be created */
type ShelfItem = { value: string; names: string[] }

/** The cell key of an unsplit value, which is optionSetKey([]) */
export const ONE = ''

export const single = <T>(value: T): Varying<T> => ({
  groupIds: [],
  cells: { [ONE]: value },
})

export const newIngredient = (): IngredientSpec => ({
  key: draftKey(),
  item: single<string | null>(null),
  amount: single(''),
})

// ---------------------------------------------------------------------------
// The one verb: split, and its undo

/** The option ids behind a cell key */
const cellIds = (key: string): string[] => (key === ONE ? [] : key.split('+'))

const inMenuOrder = (groupIds: string[], menu: MenuOptions): string[] => {
  const wanted = new Set(groupIds)
  return menu.groups.filter((g) => wanted.has(g.id)).map((g) => g.id)
}

/**
 * Split by one more group: every cell fans out over the group's options,
 * each new cell starting from the value it came from, so a split changes
 * nothing until a cell is edited.
 */
export function split<T>(
  varying: Varying<T>,
  group: MenuGroup,
  menu: MenuOptions
): Varying<T> {
  if (varying.groupIds.includes(group.id)) return varying
  const cells: Record<string, T> = {}
  for (const [key, value] of Object.entries(varying.cells)) {
    for (const option of group.options) {
      cells[optionSetKey([...cellIds(key), option.id])] = value
    }
  }
  return {
    groupIds: inMenuOrder([...varying.groupIds, group.id], menu),
    cells,
  }
}

/**
 * Undo a split: the cells where the group sits at its standard choice
 * survive and the rest are dropped, so merging is the plain inverse of
 * splitting an untouched value.
 */
export function merge<T>(
  varying: Varying<T>,
  groupId: string,
  menu: MenuOptions
): Varying<T> {
  const group = menu.groups.find((g) => g.id === groupId)
  if (!group || !varying.groupIds.includes(groupId)) return varying
  const keep = representative(group).id
  const cells: Record<string, T> = {}
  for (const [key, value] of Object.entries(varying.cells)) {
    const ids = cellIds(key)
    if (!ids.includes(keep)) continue
    cells[optionSetKey(ids.filter((id) => id !== keep))] = value
  }
  return { groupIds: varying.groupIds.filter((id) => id !== groupId), cells }
}

/**
 * Split onto exactly these groups: what went is merged out, what came is
 * split in. The picker hands the whole set, so this is what a tick or an
 * untick means.
 */
export function resplit<T>(
  varying: Varying<T>,
  groupIds: readonly string[],
  menu: MenuOptions
): Varying<T> {
  const wanted = new Set(groupIds)
  let next = varying
  for (const id of varying.groupIds) {
    if (!wanted.has(id)) next = merge(next, id, menu)
  }
  for (const id of groupIds) {
    const group = menu.groups.find((g) => g.id === id)
    if (group) next = split(next, group, menu)
  }
  return next
}

// ---------------------------------------------------------------------------
// Guessing a bag from its name

/** Arabic and Latin names folded to one spelling for matching */
export function fold(text: string): string {
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
 * Whether a bag could be the one for a combination: a bag whose name names
 * no choice of a group fits every cell of it ("\u0628\u0646 \u062a\u0631\u0643\u064a" fits both roasts),
 * and one that names a choice fits only that choice's cells.
 */
function fits(
  item: ShelfItem,
  combo: MenuOption[],
  groups: MenuGroup[]
): boolean {
  const names = item.names.map(fold)
  return groups.every((group, index) => {
    const claimed = group.options.find((o) =>
      o.names.some((n) => names.some((m) => m.includes(fold(n))))
    )
    return !claimed || claimed.id === combo[index].id
  })
}

/**
 * Split an item onto these groups, filling each cell from the bag's name.
 * A plain resplit copies one bag into every cell, which reads as six
 * shelves all holding the same bag; here a cell whose bag cannot belong to
 * it is guessed again, and one whose bag could belong is left alone \u2014 so a
 * bag the admin picked, and a bag that serves every choice, both survive.
 */
export function resplitItem(
  varying: Varying<string | null>,
  groupIds: readonly string[],
  menu: MenuOptions,
  ingredients: ShelfItem[]
): Varying<string | null> {
  const next = resplit(varying, groupIds, menu)
  const groups = next.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => Boolean(g))
  if (groups.length === 0) return next

  const cells = { ...next.cells }
  for (const combo of combos(groups)) {
    const key = optionSetKey(combo.map((o) => o.id))
    const held = cells[key]
    const bag = held ? ingredients.find((i) => i.value === held) : undefined
    if (bag && !fits(bag, combo, groups)) {
      cells[key] = guessCell(bag, combo, groups, ingredients)
    }
  }
  return { ...next, cells }
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

/** A line read as a cell: it deducts only when it names an item and a positive amount */
const lineCell = (
  stockItemId: string | null,
  quantity: string,
  exists: boolean
): Cell => {
  const amount = parseFloat(quantity)
  return exists && stockItemId && amount > 0
    ? { item: stockItemId, quantity: amount, present: true }
    : NOTHING
}

/** One option per group, or none where the sale carries nothing of that group */
type Choice = Map<string, MenuOption | undefined>

const choiceOf = (
  groups: MenuGroup[],
  pick: (group: MenuGroup, index: number) => MenuOption | undefined
): Choice => new Map(groups.map((g, i) => [g.id, pick(g, i)] as const))

/** A group's own options with its standard choice first */
const standardFirst = (group: MenuGroup): MenuOption[] => {
  const rep = representative(group)
  return [rep, ...group.options.filter((o) => o !== rep)]
}

/** A group's picks including "untouched", which only an add-on can be */
const picksOf = (group: MenuGroup): Array<MenuOption | undefined> =>
  group.allowMultiple ? [undefined, ...group.options] : standardFirst(group)

/** Every choice the till can send over these groups, the standard sale first */
function choiceSpace(groups: MenuGroup[]): Choice[] {
  const rows = groups.reduce<Array<Array<MenuOption | undefined>>>(
    (acc, group) =>
      acc.flatMap((row) => picksOf(group).map((pick) => [...row, pick])),
    [[]]
  )
  return rows.map(
    (row) => new Map(groups.map((g, i) => [g.id, row[i]] as const))
  )
}

/** What a split says for a choice; a group the sale carries no option of decides nothing */
function valueAt<T>(varying: Varying<T>, choice: Choice, missing: T): T {
  if (varying.groupIds.length === 0) return varying.cells[ONE] ?? missing
  const picked: string[] = []
  for (const id of varying.groupIds) {
    const option = choice.get(id)
    if (!option) return missing
    picked.push(option.id)
  }
  return varying.cells[optionSetKey(picked)] ?? missing
}

/** What a card says for a choice */
function cellFor(spec: IngredientSpec, choice: Choice): Cell {
  const item = valueAt(spec.item, choice, null)
  const quantity = parseFloat(valueAt(spec.amount, choice, ''))
  return item && quantity > 0 ? { item, quantity, present: true } : NOTHING
}

/**
 * The answers compiled into slots. An ingredient split by groups K gets an
 * override for every combination over K and, as the slot's default, the
 * combination the till sends when nothing is touched. An add-on group
 * contributes only the choices the ingredient is deducted for: a sale may
 * carry several of its options at once, and a "nothing" override for a
 * sibling would tie with the add-on's own and win by order.
 */
export function compile(state: BuilderState, menu: MenuOptions): RecipeDraft {
  const slots: SlotDraft[] = []
  for (const spec of state.ingredients) {
    const keyIds = new Set([...spec.item.groupIds, ...spec.amount.groupIds])
    const keyGroups = menu.groups.filter((g) => keyIds.has(g.id))

    if (keyGroups.length === 0) {
      slots.push({
        key: spec.key,
        stockItemId: spec.item.cells[ONE] ?? null,
        quantity: spec.amount.cells[ONE] ?? '',
        hasDefault: true,
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
    const anchor = Object.values(spec.item.cells).find((v) => v) ?? null
    if (!base.present && !anchor) continue
    slots.push({
      key: spec.key,
      stockItemId: base.item ?? anchor,
      quantity: base.present ? String(base.quantity) : '',
      hasDefault: base.present,
      groupIds: keyGroups.map((g) => g.id),
      overrides,
    })
  }
  return { slots: [...slots, ...state.custom] }
}

/**
 * The cards read back from a saved draft: the slot is resolved the way the
 * till resolves it, then each group is asked whether the item or the
 * amount changes across its options — that is the split it was written
 * with. The reading is only kept when recompiling it deducts exactly what
 * the slot did; anything else stays a custom rule.
 */
export function reconstruct(
  draft: RecipeDraft,
  menu: MenuOptions
): BuilderState {
  const groupOf = new Map<string, MenuGroup>()
  for (const g of menu.groups) for (const o of g.options) groupOf.set(o.id, g)

  const ingredients: IngredientSpec[] = []
  const custom: SlotDraft[] = []
  for (const slot of draft.slots) {
    const card = readCard(slot, menu, groupOf)
    if (card) ingredients.push(card)
    else custom.push(slot)
  }
  return { ingredients, custom }
}

/** One card from a slot, or null when the cards cannot say what it says */
function readCard(
  slot: SlotDraft,
  menu: MenuOptions,
  groupOf: Map<string, MenuGroup>
): IngredientSpec | null {
  // A rule naming an option the menu no longer has cannot be read back; it
  // stays custom so the editor shows it as it is instead of losing it
  if (slot.overrides.some((o) => o.optionIds.some((id) => !groupOf.has(id)))) {
    return null
  }

  const groups = menu.groups.filter((g) =>
    slot.overrides.some((o) =>
      o.optionIds.some((id) => groupOf.get(id)?.id === g.id)
    )
  )
  if (groups.length === 0) {
    return slot.hasDefault
      ? {
          key: slot.key,
          item: single<string | null>(slot.stockItemId),
          amount: single(slot.quantity),
        }
      : null
  }

  const defaultCell = lineCell(slot.stockItemId, slot.quantity, slot.hasDefault)
  const cellOf = (o: OverrideDraft): Cell =>
    o.none
      ? NOTHING
      : lineCell(
          o.stockItemId ?? slot.stockItemId,
          o.quantity !== '' ? o.quantity : slot.quantity,
          true
        )

  // An add-on group decides presence: a sale that did not tick it carries
  // no option of the group, so a default in that slot would deduct on every
  // sale — never what an add-on means. A default beside add-on rules is
  // either what the cards used to write (the add-on's own cell again, from
  // when the group's first option counted as the standard choice) or a
  // genuine replacement the cards cannot express.
  const addOns = groups.filter((g) => g.allowMultiple)
  if (addOns.length > 0 && defaultCell.present) {
    const legacy = slot.overrides.some((o) => {
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

  /** What the slot deducts for a choice — the draft's mirror of Recipe.Resolve */
  const at = (choice: Choice): Cell => {
    const chosen = new Set<string>()
    for (const option of choice.values()) if (option) chosen.add(option.id)
    let best: OverrideDraft | undefined
    for (const o of slot.overrides) {
      if (o.optionIds.length === 0) continue
      if (!o.optionIds.every((id) => chosen.has(id))) continue
      // Ties keep the earlier rule, so the order the recipe was saved in decides
      if (!best || o.optionIds.length > best.optionIds.length) best = o
    }
    return best ? cellOf(best) : fallback
  }

  /** Whether what `read` sees changes across a group's picks, the others held anywhere */
  const varies = (
    group: MenuGroup,
    read: (cell: Cell) => unknown,
    presentOnly: boolean
  ) => {
    const others = groups.filter((g) => g !== group)
    for (const row of choiceSpace(others)) {
      const seen = new Set<unknown>()
      for (const pick of picksOf(group)) {
        const choice = new Map(row)
        choice.set(group.id, pick)
        const cell = at(choice)
        // A "nothing" cell says nothing about the item, only about presence
        if (presentOnly && !cell.present) continue
        seen.add(read(cell))
      }
      if (seen.size > 1) return true
    }
    return false
  }

  const space = choiceSpace(groups)
  // The standard sale, or the nearest choice the ingredient is deducted at
  const reference = space.find((choice) => at(choice).present)
  if (!reference) return null

  const over = <T>(vary: MenuGroup[], read: (cell: Cell) => T): Varying<T> => {
    if (vary.length === 0) return single(read(at(reference)))
    const cells: Record<string, T> = {}
    for (const combo of combos(vary)) {
      const choice = new Map(reference)
      vary.forEach((g, i) => choice.set(g.id, combo[i]))
      cells[optionSetKey(combo.map((o) => o.id))] = read(at(choice))
    }
    return { groupIds: vary.map((g) => g.id), cells }
  }

  const spec: IngredientSpec = {
    key: slot.key,
    item: over(
      groups.filter((g) => varies(g, (c) => c.item, true)),
      (c) => c.item
    ),
    amount: over(
      groups.filter((g) =>
        varies(g, (c) => (c.present ? c.quantity : 0), false)
      ),
      (c) => (c.present ? String(c.quantity) : '0')
    ),
  }

  // Kept only when it deducts exactly what the slot did, everywhere. This
  // is what lets the cards drop every arity ceiling: a reading that cannot
  // say the slot is simply not equal to it.
  const same = space.every((choice) => {
    const was = at(choice)
    const now = cellFor(spec, choice)
    if (was.present !== now.present) return false
    return (
      !was.present || (was.item === now.item && was.quantity === now.quantity)
    )
  })
  return same ? spec : null
}
