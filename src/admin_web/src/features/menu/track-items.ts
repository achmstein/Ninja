import { type CatalogItemDto } from '@/api/catalog'
import {
  type MenuItemToTrack,
  type ProposedRecipe,
  type ProposedRecipeLine,
  type RecipesProposal,
} from '@/api/inventory'
import {
  primaryText,
  toLocalizedValue,
  type LocalizedValue,
} from '@/lib/localized-value'
import { toNumber } from '@/lib/money'
import {
  draftKey,
  validateDraft,
  type RecipeDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import { menuOptionsOf } from './menu-options'

/**
 * Menu items per assistant call; a longer list goes up in batches. Small
 * enough that a batch's recipes fit the answer's ceiling with room to spare
 */
export const PROPOSE_BATCH = 10

/**
 * A menu item as the proposer wants it: names, options, price; Inventory keeps no copy of the menu.
 * `brief`: the owner's own words for the recipe, which the assistant follows over typical amounts
 */
export function toMenuItemToTrack(
  item: CatalogItemDto,
  brief?: string
): MenuItemToTrack {
  return {
    brief: brief?.trim() || null,
    catalogItemId: toNumber(item.id),
    name: { en: item.name?.en ?? null, ar: item.name?.ar ?? null },
    description: item.description
      ? { en: item.description.en ?? null, ar: item.description.ar ?? null }
      : null,
    category: primaryText(item.catalogTypeName) || null,
    price: toNumber(item.price),
    options: (item.customizations ?? []).flatMap((group) =>
      (group.options ?? []).map((option) => ({
        id: toNumber(option.id),
        group: primaryText(group.name),
        name: { en: option.name?.en ?? null, ar: option.name?.ar ?? null },
      }))
    ),
  }
}

/** A proposed ingredient as the review sheet edits it */
export type ReviewIngredient = {
  key: string
  name: LocalizedValue
  unit: string
  packSize: string
  packName: LocalizedValue
  autoSoldOut: boolean
  /** Filled once created, so a retry after a failure never creates it twice */
  createdId: number | null
}

export type ReviewRecipe = {
  catalogItemId: number
  include: boolean
  kind: 'unit' | 'recipe'
  /** The proposed slots as the editor holds them; a "new:<key>" item is an ingredient still to create */
  draft: RecipeDraft
  warnings: string[]
  /** True once the recipe was set (or the item tracked by unit) */
  done: boolean
}

export const NEW_PREFIX = 'new:'

const ingredientOf = (line: ProposedRecipeLine): string | null =>
  line.stockItemId != null
    ? String(toNumber(line.stockItemId))
    : line.newItemKey
      ? NEW_PREFIX + line.newItemKey
      : null

/** A proposed recipe as a draft: lines grouped by slot, overrides under their groups, factors as typed */
function draftOf(
  recipe: ProposedRecipe,
  item: CatalogItemDto | undefined
): RecipeDraft {
  const menu = item ? menuOptionsOf(item, primaryText) : null
  const groupOf = (optionId: string) => {
    const option = menu?.byId.get(optionId)
    return option ? menu?.groups[option.groupIndex]?.id : undefined
  }
  const groupOrder = menu?.groups.map((g) => g.id) ?? []

  // Slot 0 means a slot of its own, the way the API reads it
  const slots = new Map<string, ProposedRecipeLine[]>()
  let own = 0
  for (const line of recipe.lines) {
    const key =
      toNumber(line.slot) > 0 ? `s${toNumber(line.slot)}` : `o${own++}`
    slots.set(key, [...(slots.get(key) ?? []), line])
  }

  const drafts: SlotDraft[] = []
  for (const lines of slots.values()) {
    const base = lines.find((l) => l.optionIds.length === 0)
    const overrides = lines.filter((l) => l !== base)
    const groups = new Set<string>()
    for (const line of overrides) {
      for (const id of line.optionIds) {
        const group = groupOf(String(toNumber(id)))
        if (group) groups.add(group)
      }
    }
    drafts.push({
      key: draftKey(),
      stockItemId: base ? ingredientOf(base) : null,
      quantity: base ? String(toNumber(base.quantity)) : '',
      hasDefault: !!base,
      groupIds: groupOrder.filter((g) => groups.has(g)),
      overrides: overrides.map((line) => ({
        key: draftKey(),
        optionIds: line.optionIds.map((id) => String(toNumber(id))),
        // A "none" override takes nothing of the slot for its options ("plain": no sugar)
        stockItemId: line.none ? null : ingredientOf(line),
        quantity: line.none ? '' : String(toNumber(line.quantity)),
        none: line.none ?? false,
      })),
    })
  }

  return { slots: drafts }
}

/** A name folded for matching: case, spacing and Arabic marks do not count */
const foldName = (text: string | null | undefined): string =>
  (text ?? '')
    .replace(/[ً-ْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

/** The draft with every "new:<alias>" pointed at the ingredient it was merged into */
function remapNew(
  draft: RecipeDraft,
  aliases: Map<string, string>
): RecipeDraft {
  const remap = (id: string | null) =>
    id?.startsWith(NEW_PREFIX) && aliases.has(id.slice(NEW_PREFIX.length))
      ? NEW_PREFIX + aliases.get(id.slice(NEW_PREFIX.length))
      : id
  return {
    slots: draft.slots.map((slot) => ({
      ...slot,
      stockItemId: remap(slot.stockItemId),
      overrides: slot.overrides.map((o) => ({
        ...o,
        stockItemId: remap(o.stockItemId),
      })),
    })),
  }
}

/**
 * Several batches' answers become one review: recipes in menu order, and
 * one ingredient for what the batches each proposed as new — by key, or by
 * name when two batches named the same thing under different keys (each
 * batch sees only the shelf, not the other batches' new ingredients).
 */
export function toReview(
  proposals: RecipesProposal[],
  items: CatalogItemDto[]
): {
  ingredients: ReviewIngredient[]
  recipes: ReviewRecipe[]
  warnings: string[]
} {
  const itemById = new Map(items.map((item) => [toNumber(item.id), item]))
  const ingredients = new Map<string, ReviewIngredient>()
  const recipes: ReviewRecipe[] = []
  const warnings: string[] = []
  for (const proposal of proposals) {
    warnings.push(...proposal.warnings)
    if (proposal.notes) warnings.push(proposal.notes)
    const aliases = new Map<string, string>()
    for (const item of proposal.newItems) {
      if (ingredients.has(item.key)) continue
      const same = [...ingredients.values()].find(
        (known) =>
          (foldName(item.name.en) !== '' &&
            foldName(known.name.en) === foldName(item.name.en)) ||
          (foldName(item.name.ar) !== '' &&
            foldName(known.name.ar) === foldName(item.name.ar))
      )
      if (same) {
        aliases.set(item.key, same.key)
        continue
      }
      ingredients.set(item.key, {
        key: item.key,
        name: toLocalizedValue(item.name),
        unit: item.unit,
        packSize: item.packSize != null ? String(toNumber(item.packSize)) : '',
        packName: toLocalizedValue(item.packName),
        autoSoldOut: item.autoSoldOut,
        createdId: null,
      })
    }
    for (const recipe of proposal.recipes) {
      const usable = recipe.kind === 'unit' || recipe.lines.length > 0
      recipes.push({
        catalogItemId: toNumber(recipe.catalogItemId),
        include: usable,
        kind: recipe.kind === 'unit' ? 'unit' : 'recipe',
        draft: remapNew(
          draftOf(recipe, itemById.get(toNumber(recipe.catalogItemId))),
          aliases
        ),
        warnings: recipe.warnings,
        done: false,
      })
    }
  }
  return { ingredients: [...ingredients.values()], recipes, warnings }
}

/** Every "new:<key>" ingredient a draft points at */
function newKeysOf(draft: RecipeDraft): string[] {
  const keys: string[] = []
  for (const slot of draft.slots) {
    for (const id of [
      slot.stockItemId,
      ...slot.overrides.map((o) => o.stockItemId),
    ]) {
      if (id?.startsWith(NEW_PREFIX)) keys.push(id.slice(NEW_PREFIX.length))
    }
  }
  return keys
}

/** The ingredients the included recipes still need created */
export function neededIngredients(
  recipes: ReviewRecipe[],
  ingredients: ReviewIngredient[]
): ReviewIngredient[] {
  const needed = new Set<string>()
  for (const recipe of recipes) {
    if (!recipe.include || recipe.kind !== 'recipe' || recipe.done) continue
    for (const key of newKeysOf(recipe.draft)) needed.add(key)
  }
  return ingredients.filter((i) => needed.has(i.key))
}

/** A recipe is ready when it is a unit, or its draft would save */
export function isRecipeReady(recipe: ReviewRecipe): boolean {
  return recipe.kind === 'unit' || validateDraft(recipe.draft) === null
}

/** The draft with every "new:<key>" ingredient replaced by the id it was created with */
export function withCreatedIds(
  draft: RecipeDraft,
  createdIds: Map<string, number>
): RecipeDraft {
  const resolveId = (id: string | null) =>
    id?.startsWith(NEW_PREFIX)
      ? String(createdIds.get(id.slice(NEW_PREFIX.length)) ?? id)
      : id
  return {
    ...draft,
    slots: draft.slots.map((slot) => ({
      ...slot,
      stockItemId: resolveId(slot.stockItemId),
      overrides: slot.overrides.map((o) => ({
        ...o,
        stockItemId: resolveId(o.stockItemId),
      })),
    })),
  }
}
