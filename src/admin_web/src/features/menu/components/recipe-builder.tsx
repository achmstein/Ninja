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
  optionSetKey,
  type RecipeDraft,
} from '@/features/inventory/recipe-model'
import { type MenuGroup, type MenuOptions } from '../menu-options'
import {
  combos,
  compile,
  guessCell,
  newIngredient,
  reconstruct,
  type BuilderState,
  type IngredientSpec,
} from '../recipe-cards'
import {
  Arrow,
  RecipeSlotsEditor,
  type IngredientOption,
} from './recipe-editor'

/**
 * The recipe the way the admin describes it: for each ingredient, which
 * item (fixed, or a table by the choices that decide it — the bag by
 * roast × spice), how much (fixed, or a number per choice — the grams by
 * size, the sugar by sugar level), and when (always, or only with some
 * choices — the paper cup). No defaults to think about: every cell of a
 * table is asked for, bags are guessed from their names, and the slot
 * draft the till reads is compiled from the answers (recipe-cards.ts),
 * with what the till sends for an untouched group worked out there. What
 * the cards cannot express is kept as custom rules for the advanced
 * editor.
 */
type Props = {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
  ingredients: IngredientOption[]
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

      <div className='border-t'>
        <div className='flex items-center gap-2 px-3 py-2'>
          <span className='text-muted-foreground w-14 shrink-0 text-xs'>
            {t('howMuch')}
          </span>
          <div className='min-w-0 flex-1'>
            {amountGroup ? (
              <span className='text-muted-foreground text-xs'>
                {t('amountDecidedBelow')}
              </span>
            ) : (
              <Quantity
                value={spec.amount.fixed}
                unit={unit}
                onChange={(fixed) =>
                  onChange({ amount: { ...spec.amount, fixed } })
                }
              />
            )}
          </div>
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
        </div>
        {amountGroup && (
          <>
            <div className='grid gap-2 border-t p-2 sm:grid-cols-2'>
              {amountGroup.options.map((o) => (
                <div
                  key={o.id}
                  className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs'
                >
                  <span className='truncate'>{o.label}</span>
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
                </div>
              ))}
            </div>
            <p className='text-muted-foreground px-3 pb-2 text-xs'>
              {t('zeroMeansNothing')}
            </p>
          </>
        )}
      </div>

      {menu.groups.length > 0 && (
        <div className='border-t'>
          <div className='flex items-center gap-2 px-3 py-2'>
            <span className='text-muted-foreground w-14 shrink-0 text-xs'>
              {t('whenDeducted')}
            </span>
            <div className='min-w-0 flex-1'>
              <span
                className={cn('text-xs', whenGroup && 'text-muted-foreground')}
              >
                {whenGroup ? t('whenDecidedBelow') : t('always')}
              </span>
            </div>
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
          {whenGroup && (
            <div className='grid gap-2 border-t p-2 sm:grid-cols-2'>
              {whenGroup.options.map((o) => (
                <label
                  key={o.id}
                  className='flex cursor-pointer items-center gap-2 text-xs'
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
          )}
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
              {rows.label} ↓ {cols.label} <Arrow />
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
