import { useState } from 'react'
import { ChevronsUpDown, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { unitLabel } from '@/features/inventory/format'
import {
  draftKey,
  optionSetKey,
  overrideHasContent,
  type OverrideDraft,
  type RecipeDraft,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import {
  type MenuGroup,
  type MenuOption,
  type MenuOptions,
} from '../menu-options'
import { RecipeSlotsEditor, type IngredientOption } from './recipe-editor'

/**
 * The recipe the way the admin describes it: for each ingredient, which
 * item (fixed, or a table by the choices that decide it — the bag by
 * roast × spice), how much (fixed, or a number per choice — the grams by
 * size, the sugar by sugar level), and when (always, or only with some
 * choices — the paper cup). No defaults to think about: every cell of a
 * table is asked for, bags are guessed from their names, and the slot
 * draft the till reads is compiled from the answers, with the fallback
 * for an unchosen optional group worked out here. What the cards cannot
 * express is kept as custom rules for the advanced editor.
 */
type Props = {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
  ingredients: IngredientOption[]
}

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

type BuilderState = {
  ingredients: IngredientSpec[]
  /** Slots the cards could not express, kept verbatim */
  custom: SlotDraft[]
}

export function RecipeBuilder({ draft, onChange, menu, ingredients }: Props) {
  const t = useT()
  const [advanced, setAdvanced] = useState(false)
  const [state, setState] = useState<BuilderState>(() =>
    reconstruct(draft, menu)
  )
  const byValue = new Map(ingredients.map((i) => [i.value, i]))
  const options: ComboboxOption[] = ingredients.map((i) => ({
    value: i.value,
    label: i.label,
    hint: unitLabel(i.unit, t),
  }))

  const commit = (next: BuilderState) => {
    setState(next)
    onChange(compile(next, menu))
  }
  const update = (key: number, patch: Partial<IngredientSpec>) =>
    commit({
      ...state,
      ingredients: state.ingredients.map((i) =>
        i.key === key ? { ...i, ...patch } : i
      ),
    })

  if (advanced) {
    return (
      <div className='space-y-3'>
        <RecipeSlotsEditor
          draft={draft}
          onChange={onChange}
          menu={menu}
          ingredients={ingredients}
        />
        <Button
          type='button'
          variant='link'
          size='sm'
          className='h-auto p-0 text-xs'
          onClick={() => {
            setState(reconstruct(draft, menu))
            setAdvanced(false)
          }}
        >
          {t('simpleEditor')}
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-xs'>{t('builderHint')}</p>

      {state.ingredients.map((spec) => (
        <IngredientCard
          key={spec.key}
          spec={spec}
          menu={menu}
          options={options}
          byValue={byValue}
          ingredients={ingredients}
          onChange={(patch) => update(spec.key, patch)}
          onRemove={() =>
            commit({
              ...state,
              ingredients: state.ingredients.filter((i) => i.key !== spec.key),
            })
          }
        />
      ))}

      {state.custom.length > 0 && (
        <div className='flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs'>
          <Badge variant='outline' className='font-normal'>
            {t('customRulesCount', { count: state.custom.length })}
          </Badge>
          <button
            type='button'
            className='underline'
            onClick={() => setAdvanced(true)}
          >
            {t('advancedEditor')}
          </button>
          <button
            type='button'
            className='text-muted-foreground underline'
            onClick={() => commit({ ...state, custom: [] })}
          >
            {t('dropCustomRules')}
          </button>
        </div>
      )}

      <div className='flex flex-wrap items-center gap-3'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() =>
            commit({
              ...state,
              ingredients: [...state.ingredients, newIngredient()],
            })
          }
        >
          <Plus className='me-1 h-3.5 w-3.5' />
          {t('addIngredient')}
        </Button>
        <Button
          type='button'
          variant='link'
          size='sm'
          className='text-muted-foreground h-auto p-0 text-xs'
          onClick={() => setAdvanced(true)}
        >
          <SlidersHorizontal className='me-1 size-3' />
          {t('advancedEditor')}
        </Button>
      </div>
    </div>
  )
}

const newIngredient = (): IngredientSpec => ({
  key: draftKey(),
  item: { fixed: null, groupIds: [], cells: {} },
  amount: { fixed: '', groupId: null, values: {} },
  when: { groupId: null, only: [] },
})

// ---------------------------------------------------------------------------
// One card per ingredient: which item, how much, when

function IngredientCard({
  spec,
  menu,
  options,
  byValue,
  ingredients,
  onChange,
  onRemove,
}: {
  spec: IngredientSpec
  menu: MenuOptions
  options: ComboboxOption[]
  byValue: Map<string, IngredientOption>
  ingredients: IngredientOption[]
  onChange: (patch: Partial<IngredientSpec>) => void
  onRemove: () => void
}) {
  const t = useT()
  const single = menu.groups.filter((g) => !g.allowMultiple)
  const baseId =
    spec.item.fixed ?? Object.values(spec.item.cells).find((v) => v) ?? null
  const base = baseId ? byValue.get(baseId) : undefined
  const unit = base?.unit ?? ''
  const itemGroups = spec.item.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => !!g)
  const amountGroup = menu.groups.find((g) => g.id === spec.amount.groupId)
  const whenGroup = menu.groups.find((g) => g.id === spec.when.groupId)

  // Switching the item to "depends on": every cell guessed from the base bag's name
  const setItemGroups = (groupIds: string[]) => {
    const groups = groupIds
      .map((id) => menu.groups.find((g) => g.id === id))
      .filter((g): g is MenuGroup => !!g)
    const cells: Record<string, string | null> = {}
    for (const combo of combos(groups)) {
      const key = optionSetKey(combo.map((o) => o.id))
      cells[key] =
        spec.item.cells[key] ??
        (base ? guessCell(base, combo, groups, ingredients) : null)
    }
    onChange({ item: { ...spec.item, groupIds, cells } })
  }

  // One bag picked in any cell: the empty cells are guessed from its name
  const setCell = (key: string, value: string | null) => {
    const cells = { ...spec.item.cells, [key]: value }
    let fixed = spec.item.fixed
    const picked = value ? byValue.get(value) : undefined
    if (picked) {
      if (!fixed) fixed = value
      for (const combo of combos(itemGroups)) {
        const k = optionSetKey(combo.map((o) => o.id))
        if (!cells[k])
          cells[k] = guessCell(picked, combo, itemGroups, ingredients)
      }
    }
    onChange({ item: { ...spec.item, fixed, cells } })
  }

  const setAmountGroup = (groupId: string | null) => {
    const group = menu.groups.find((g) => g.id === groupId)
    const values: Record<string, string> = {}
    for (const o of group?.options ?? []) {
      values[o.id] = spec.amount.values[o.id] ?? spec.amount.fixed
    }
    onChange({ amount: { ...spec.amount, groupId, values } })
  }

  const setWhenGroup = (groupId: string | null) => {
    const group = menu.groups.find((g) => g.id === groupId)
    onChange({
      when: { groupId, only: group ? group.options.map((o) => o.id) : [] },
    })
  }

  return (
    <div className='rounded-lg border'>
      <div className='flex items-center gap-2 border-b px-3 py-2'>
        <span className='text-muted-foreground w-14 shrink-0 text-xs'>
          {t('whichItem')}
        </span>
        <div className='min-w-0 flex-1'>
          {itemGroups.length === 0 ? (
            <Combobox
              value={spec.item.fixed}
              onChange={(value) =>
                onChange({ item: { ...spec.item, fixed: value } })
              }
              options={options}
              placeholder={t('pickStockItem')}
              size='sm'
              wrap
            />
          ) : (
            <span className='text-muted-foreground text-xs'>
              {t('itemDecidedBelow')}
            </span>
          )}
        </div>
        {single.length > 0 && (
          <GroupPicker
            groups={single}
            value={spec.item.groupIds}
            max={2}
            label={
              itemGroups.length > 0
                ? t('dependsOn', {
                    groups: itemGroups.map((g) => g.label).join(' × '),
                  })
                : t('fixed')
            }
            onChange={setItemGroups}
          />
        )}
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8 shrink-0'
          aria-label={t('removeLine')}
          onClick={onRemove}
        >
          <X className='h-4 w-4' />
        </Button>
      </div>

      {itemGroups.length > 0 && (
        <>
          <ItemTable
            groups={itemGroups}
            cells={spec.item.cells}
            options={options}
            onCell={setCell}
          />
          <p className='text-muted-foreground px-3 pb-2 text-xs'>
            {t('guessHint')}
          </p>
        </>
      )}

      <div className='flex flex-wrap items-center gap-2 border-t px-3 py-2'>
        <span className='text-muted-foreground w-14 shrink-0 text-xs'>
          {t('howMuch')}
        </span>
        {amountGroup ? (
          <div className='flex flex-wrap gap-x-4 gap-y-1'>
            {amountGroup.options.map((o) => (
              <label key={o.id} className='flex items-center gap-1.5 text-xs'>
                <span className='max-w-32 truncate'>{o.label}</span>
                <Quantity
                  value={spec.amount.values[o.id] ?? ''}
                  unit={unit}
                  compact
                  onChange={(v) =>
                    onChange({
                      amount: {
                        ...spec.amount,
                        values: { ...spec.amount.values, [o.id]: v },
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        ) : (
          <Quantity
            value={spec.amount.fixed}
            unit={unit}
            onChange={(fixed) =>
              onChange({ amount: { ...spec.amount, fixed } })
            }
          />
        )}
        {single.length > 0 && (
          <GroupPicker
            groups={single}
            value={spec.amount.groupId ? [spec.amount.groupId] : []}
            max={1}
            label={
              amountGroup
                ? t('dependsOn', { groups: amountGroup.label })
                : t('fixed')
            }
            onChange={(ids) => setAmountGroup(ids[0] ?? null)}
          />
        )}
        {amountGroup && (
          <span className='text-muted-foreground text-xs'>
            {t('zeroMeansNothing')}
          </span>
        )}
      </div>

      {menu.groups.length > 0 && (
        <div className='flex flex-wrap items-center gap-2 border-t px-3 py-2'>
          <span className='text-muted-foreground w-14 shrink-0 text-xs'>
            {t('whenDeducted')}
          </span>
          {whenGroup ? (
            <div className='flex flex-wrap gap-x-4 gap-y-1'>
              {whenGroup.options.map((o) => (
                <label
                  key={o.id}
                  className='flex cursor-pointer items-center gap-1.5 text-xs'
                >
                  <Checkbox
                    checked={spec.when.only.includes(o.id)}
                    onCheckedChange={(on) =>
                      onChange({
                        when: {
                          ...spec.when,
                          only:
                            on === true
                              ? [...spec.when.only, o.id]
                              : spec.when.only.filter((id) => id !== o.id),
                        },
                      })
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
          ) : (
            <span className='text-xs'>{t('always')}</span>
          )}
          <GroupPicker
            groups={menu.groups}
            value={spec.when.groupId ? [spec.when.groupId] : []}
            max={1}
            label={
              whenGroup
                ? t('onlyWith', { group: whenGroup.label })
                : t('always')
            }
            onChange={(ids) => setWhenGroup(ids[0] ?? null)}
          />
        </div>
      )}
    </div>
  )
}

/** "Fixed" or "depends on …": a popover of group checkboxes, at most `max` ticked */
function GroupPicker({
  groups,
  value,
  max,
  label,
  onChange,
}: {
  groups: MenuGroup[]
  value: string[]
  max: number
  label: string
  onChange: (groupIds: string[]) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          className='h-7 max-w-52 text-xs font-normal'
        >
          <span className='truncate'>{label}</span>
          <ChevronsUpDown className='ms-1 h-3 w-3 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-56 space-y-2 p-3' align='start'>
        <label className='flex cursor-pointer items-center gap-2 text-sm'>
          <Checkbox
            checked={value.length === 0}
            onCheckedChange={(on) => on === true && onChange([])}
          />
          {t('fixed')}
        </label>
        <p className='text-muted-foreground text-xs'>{t('dependsOnWhich')}</p>
        {groups.map((group) => {
          const on = value.includes(group.id)
          const full = !on && value.length >= max
          return (
            <label
              key={group.id}
              className={cn(
                'flex items-center gap-2 text-sm',
                full ? 'text-muted-foreground' : 'cursor-pointer'
              )}
            >
              <Checkbox
                checked={on}
                disabled={full}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? groups
                          .map((g) => g.id)
                          .filter((id) => id === group.id || value.includes(id))
                      : value.filter((id) => id !== group.id)
                  )
                }
              />
              {group.label}
            </label>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

/** One picker per choice (one group) or per pair (two groups) */
function ItemTable({
  groups,
  cells,
  options,
  onCell,
}: {
  groups: MenuGroup[]
  cells: Record<string, string | null>
  options: ComboboxOption[]
  onCell: (key: string, value: string | null) => void
}) {
  const t = useT()
  if (groups.length === 1) {
    const [group] = groups
    return (
      <div className='grid gap-2 border-t p-2 sm:grid-cols-2'>
        {group.options.map((o) => {
          const key = optionSetKey([o.id])
          return (
            <div
              key={o.id}
              className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs'
            >
              <span className='truncate'>{o.label}</span>
              <Combobox
                value={cells[key] ?? null}
                onChange={(v) => onCell(key, v)}
                options={options}
                placeholder={t('pickStockItem')}
                size='sm'
                wrap
              />
            </div>
          )
        })}
      </div>
    )
  }
  const [rows, cols] = groups
  return (
    <div className='overflow-x-auto border-t p-2'>
      <table className='w-full text-xs'>
        <thead>
          <tr>
            <th className='text-muted-foreground w-24 pb-1 text-start font-normal'>
              {rows.label} ↓ {cols.label} →
            </th>
            {cols.options.map((c) => (
              <th key={c.id} className='min-w-40 pb-1 text-start font-medium'>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.options.map((r) => (
            <tr key={r.id} className='border-t'>
              <td className='py-1.5 pe-2 align-middle font-medium'>
                {r.label}
              </td>
              {cols.options.map((c) => {
                const key = optionSetKey([r.id, c.id])
                return (
                  <td key={c.id} className='py-1.5 pe-2 align-middle'>
                    <Combobox
                      value={cells[key] ?? null}
                      onChange={(v) => onCell(key, v)}
                      options={options}
                      placeholder={t('pickStockItem')}
                      size='sm'
                      wrap
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Quantity({
  value,
  unit,
  compact,
  onChange,
}: {
  value: string
  unit: string
  compact?: boolean
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <div className='relative'>
      <Input
        type='number'
        min='0'
        step='any'
        placeholder={t('quantity')}
        aria-label={t('quantity')}
        className={cn(
          compact ? 'h-7 w-24 text-xs' : 'h-8 w-32',
          unit && 'pe-8'
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && (
        <span className='text-muted-foreground pointer-events-none absolute inset-y-0 end-2 flex items-center text-xs'>
          {unitLabel(unit, t)}
        </span>
      )}
    </div>
  )
}

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
function guessCell(
  base: IngredientOption,
  combo: MenuOption[],
  groups: MenuGroup[],
  ingredients: IngredientOption[]
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

/** The option a group counts as when the customer did not pick one */
const assumed = (group: MenuGroup): MenuOption =>
  group.options.find((o) => o.isDefault) ?? group.options[0]

/**
 * The answers compiled into slots. An ingredient decided by groups K gets
 * an override for every combination over K, and the combination of the
 * assumed options as the slot's default.
 */
export function compile(state: BuilderState, menu: MenuOptions): RecipeDraft {
  const slots: SlotDraft[] = []
  for (const spec of state.ingredients) {
    const keyGroupIds = Array.from(
      new Set(
        [...spec.item.groupIds, spec.amount.groupId, spec.when.groupId].filter(
          (id): id is string => !!id
        )
      )
    )
    const keyGroups = menu.groups.filter((g) => keyGroupIds.includes(g.id))

    const resolveCell = (choice: Map<string, MenuOption>) => {
      let item = spec.item.fixed
      if (spec.item.groupIds.length > 0) {
        const key = optionSetKey(
          spec.item.groupIds.map((id) => choice.get(id)!.id)
        )
        item = spec.item.cells[key] ?? null
      }
      let quantity = parseFloat(spec.amount.fixed)
      if (spec.amount.groupId) {
        quantity = parseFloat(
          spec.amount.values[choice.get(spec.amount.groupId)!.id] ?? ''
        )
      }
      let present = true
      if (spec.when.groupId)
        present = spec.when.only.includes(choice.get(spec.when.groupId)!.id)
      return {
        item,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        present,
      }
    }

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

    const overrides: OverrideDraft[] = []
    const anchor =
      spec.item.fixed ?? Object.values(spec.item.cells).find((v) => v) ?? null
    // The empty combination (every group at its assumed option) is the
    // slot's default; every full combination is an override. The tills
    // pre-select each group's default, so a sale always carries one option
    // per group and no partial keys are needed.
    const assumedChoice = new Map<string, MenuOption>()
    for (const g of keyGroups) assumedChoice.set(g.id, assumed(g))
    const baseCell = resolveCell(assumedChoice)
    const base =
      !baseCell.present || baseCell.quantity <= 0 || !baseCell.item
        ? null
        : { stockItemId: baseCell.item, quantity: String(baseCell.quantity) }
    for (const combo of combos(keyGroups)) {
      const choice = new Map<string, MenuOption>()
      keyGroups.forEach((g, i) => choice.set(g.id, combo[i]))
      const cell = resolveCell(choice)
      const nothing = !cell.present || cell.quantity <= 0 || !cell.item
      overrides.push({
        key: draftKey(),
        optionIds: combo.map((o) => o.id),
        stockItemId: nothing ? null : cell.item,
        quantity: nothing ? '' : String(cell.quantity),
        none: nothing,
      })
    }
    if (!base && !anchor) continue
    slots.push({
      key: spec.key,
      stockItemId: base?.stockItemId ?? anchor,
      quantity: base?.quantity ?? '',
      hasDefault: base !== null,
      scalable: false,
      groupIds: keyGroups.map((g) => g.id),
      overrides,
    })
  }
  return { slots: [...slots, ...state.custom], scales: [] }
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
  const ingredients: IngredientSpec[] = []
  const custom: SlotDraft[] = []
  const groupOf = new Map<string, MenuGroup>()
  for (const g of menu.groups) for (const o of g.options) groupOf.set(o.id, g)

  for (const slot of draft.slots) {
    const overrides = slot.overrides.filter(overrideHasContent)
    if (overrides.length === 0) {
      if (slot.hasDefault) {
        ingredients.push({
          key: slot.key,
          item: { fixed: slot.stockItemId, groupIds: [], cells: {} },
          amount: { fixed: slot.quantity, groupId: null, values: {} },
          when: { groupId: null, only: [] },
        })
      } else custom.push(slot)
      continue
    }

    const groups = menu.groups.filter((g) =>
      overrides.some((o) =>
        o.optionIds.some((id) => groupOf.get(id)?.id === g.id)
      )
    )
    if (
      groups.length === 0 ||
      groups.length > 3 ||
      groups.some((g) => g.allowMultiple)
    ) {
      custom.push(slot)
      continue
    }
    const full = slot.overrides.filter(
      (o) =>
        o.optionIds.length === groups.length &&
        groups.every((g) =>
          o.optionIds.some((id) => groupOf.get(id)?.id === g.id)
        )
    )

    type Cell = { item: string | null; quantity: number; present: boolean }
    const cellOf = (o: OverrideDraft): Cell => ({
      item: o.none ? null : (o.stockItemId ?? slot.stockItemId),
      quantity: o.none
        ? 0
        : parseFloat(o.quantity !== '' ? o.quantity : slot.quantity),
      present: !o.none,
    })
    // A combination with no rule of its own is the default, when there is one
    const defaultCell: Cell | null = slot.hasDefault
      ? {
          item: slot.stockItemId,
          quantity: parseFloat(slot.quantity),
          present: true,
        }
      : null
    const at = (choice: Map<string, string>): Cell | null => {
      const o = full.find((x) =>
        groups.every((g) => x.optionIds.includes(choice.get(g.id)!))
      )
      return o ? cellOf(o) : defaultCell
    }
    const covered = combos(groups).every((combo) => {
      const choice = new Map(groups.map((g, i) => [g.id, combo[i].id]))
      return at(choice) !== null
    })
    if (!covered) {
      custom.push(slot)
      continue
    }
    const baseChoice = new Map(groups.map((g) => [g.id, assumed(g).id]))

    const varies = (g: MenuGroup, read: (c: Cell) => unknown) => {
      const others = groups.filter((x) => x.id !== g.id)
      return combos(others).some((othersCombo) => {
        const choice = new Map(baseChoice)
        others.forEach((x, i) => choice.set(x.id, othersCombo[i].id))
        const seen = new Set<unknown>()
        for (const o of g.options) {
          choice.set(g.id, o.id)
          seen.add(read(at(choice)!))
        }
        return seen.size > 1
      })
    }
    const itemGroups = groups.filter((g) => varies(g, (c) => c.item))
    const amountGroups = groups.filter(
      (g) => !itemGroups.includes(g) && varies(g, (c) => c.quantity)
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
      whenGroups.length > 1
    ) {
      custom.push(slot)
      continue
    }

    const cells: Record<string, string | null> = {}
    for (const combo of combos(itemGroups)) {
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
    ingredients.push({
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
    })
  }

  // Size factors from an older recipe become amounts per size on the scalable rows
  if (draft.scales.length > 0) {
    const sizeGroup = menu.groups.find((g) =>
      g.options.some((o) => draft.scales.some((s) => s.optionId === o.id))
    )
    if (sizeGroup) {
      for (const spec of ingredients) {
        const slot = draft.slots.find((s) => s.key === spec.key)
        if (!slot?.scalable || spec.amount.groupId) continue
        const baseQty = parseFloat(spec.amount.fixed)
        if (!(baseQty > 0)) continue
        const values: Record<string, string> = {}
        for (const o of sizeGroup.options) {
          const factor = parseFloat(
            draft.scales.find((s) => s.optionId === o.id)?.factor ?? '1'
          )
          values[o.id] = String(
            Math.round(baseQty * (factor > 0 ? factor : 1) * 1000) / 1000
          )
        }
        spec.amount = {
          fixed: spec.amount.fixed,
          groupId: sizeGroup.id,
          values,
        }
      }
    }
  }

  return { ingredients, custom }
}
