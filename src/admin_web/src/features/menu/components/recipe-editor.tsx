import { useState } from 'react'
import {
  Ban,
  ChevronDown,
  ChevronsUpDown,
  FlaskConical,
  Maximize2,
  Plus,
  X,
} from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { formatQuantity, unitLabel } from '@/features/inventory/format'
import {
  draftKey,
  newSlot,
  optionSetKey,
  overrideHasContent,
  resolve,
  type OverrideDraft,
  type RecipeDraft,
  type SlotDraft,
  type SlotLine,
  type SlotScale,
} from '@/features/inventory/recipe-model'
import {
  type MenuGroup,
  type MenuOption,
  type MenuOptions,
} from '../menu-options'

/** What a slot can be made of: the shelf, or (in the review sheet) an ingredient about to be created */
export type IngredientOption = {
  value: string
  label: string
  unit: string
  /** Both languages' names, for matching to a choice's name */
  names: string[]
}

// ---------------------------------------------------------------------------
// Shared bits

/** "فاتح + محوج", or "every sale" when empty; a removed option shows as "?" */
export function OptionChips({
  optionIds,
  menu,
  className,
}: {
  optionIds: readonly string[]
  menu: MenuOptions
  className?: string
}) {
  const t = useT()
  if (optionIds.length === 0) {
    return (
      <span className={cn('text-muted-foreground text-xs', className)}>
        {t('everySale')}
      </span>
    )
  }
  const known = optionIds
    .map((id) => menu.byId.get(id))
    .filter((o): o is MenuOption => !!o)
    .sort((a, b) => a.groupIndex - b.groupIndex || a.index - b.index)
  const removed = optionIds.length - known.length
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {known.map((o, i) => (
        <span key={o.id} className='inline-flex items-center gap-1'>
          {i > 0 && <span className='text-muted-foreground text-xs'>+</span>}
          <Badge variant='secondary' className='font-normal'>
            {o.label}
          </Badge>
        </span>
      ))}
      {removed > 0 && (
        <Badge variant='outline' className='text-muted-foreground font-normal'>
          ?
        </Badge>
      )}
    </span>
  )
}

const optionLabel = (option: MenuOption, t: (k: 'standardChoice') => string) =>
  option.isDefault ? `${option.label} (${t('standardChoice')})` : option.label

// ---------------------------------------------------------------------------
// The editor

type EditorProps = {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
  ingredients: IngredientOption[]
}

/**
 * A recipe as the admin thinks of it: rows for the things one sale takes,
 * each with what it is by default, whether it grows with the size, and
 * which choices change it — then a grid under the row with what each
 * choice (or pair of choices) makes of it. Size is one row of factors.
 */
export function RecipeSlotsEditor({
  draft,
  onChange,
  menu,
  ingredients,
}: EditorProps) {
  const t = useT()
  const byValue = new Map(ingredients.map((i) => [i.value, i]))
  const options: ComboboxOption[] = ingredients.map((i) => ({
    value: i.value,
    label: i.label,
    hint: unitLabel(i.unit, t),
  }))
  const hasChoices = menu.groups.length > 0
  const sizeable = menu.groups.some((g) => !g.allowMultiple)

  const updateSlot = (key: number, patch: Partial<SlotDraft>) =>
    onChange({
      ...draft,
      slots: draft.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    })

  return (
    <div className='space-y-3'>
      <p className='text-muted-foreground text-xs'>{t('recipeSlotsHint')}</p>

      {draft.slots.map((slot) => (
        <SlotEditor
          key={slot.key}
          slot={slot}
          menu={menu}
          options={options}
          byValue={byValue}
          hasChoices={hasChoices}
          sizeable={sizeable}
          onChange={(patch) => updateSlot(slot.key, patch)}
          onRemove={() =>
            onChange({
              ...draft,
              slots: draft.slots.filter((s) => s.key !== slot.key),
            })
          }
        />
      ))}

      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() =>
          onChange({ ...draft, slots: [...draft.slots, newSlot()] })
        }
      >
        <Plus className='me-1 h-3.5 w-3.5' />
        {t('addIngredient')}
      </Button>

      {sizeable && (
        <ScaleEditor draft={draft} onChange={onChange} menu={menu} />
      )}
    </div>
  )
}

function SlotEditor({
  slot,
  menu,
  options,
  byValue,
  hasChoices,
  sizeable,
  onChange,
  onRemove,
}: {
  slot: SlotDraft
  menu: MenuOptions
  options: ComboboxOption[]
  byValue: Map<string, IngredientOption>
  hasChoices: boolean
  sizeable: boolean
  onChange: (patch: Partial<SlotDraft>) => void
  onRemove: () => void
}) {
  const t = useT()
  const unit = slot.stockItemId
    ? (byValue.get(slot.stockItemId)?.unit ?? '')
    : ''

  return (
    <div className='rounded-lg border'>
      <div className='grid gap-2 p-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto_auto] sm:items-center'>
        <Combobox
          value={slot.stockItemId}
          onChange={(value) => onChange({ stockItemId: value })}
          options={options}
          placeholder={
            slot.hasDefault ? t('pickStockItem') : t('nothingByDefault')
          }
          disabled={!slot.hasDefault}
          size='sm'
          wrap
        />
        <QuantityInput
          value={slot.quantity}
          unit={unit}
          disabled={!slot.hasDefault}
          onChange={(quantity) => onChange({ quantity })}
        />
        {hasChoices ? (
          <DependsOnPicker
            menu={menu}
            value={slot.groupIds}
            onChange={(groupIds) => onChange({ groupIds })}
          />
        ) : (
          <span />
        )}
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='size-8 justify-self-end'
          aria-label={t('removeLine')}
          onClick={onRemove}
        >
          <X className='h-4 w-4' />
        </Button>
      </div>

      {hasChoices && (
        <div className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-2 text-xs'>
          {sizeable && (
            <label className='flex cursor-pointer items-center gap-1.5'>
              <Checkbox
                checked={slot.scalable}
                onCheckedChange={(on) => onChange({ scalable: on === true })}
              />
              <Maximize2 className='size-3' aria-hidden />
              {t('growsWithSize')}
            </label>
          )}
          {slot.groupIds.length > 0 && (
            <label className='flex cursor-pointer items-center gap-1.5'>
              <Checkbox
                checked={!slot.hasDefault}
                onCheckedChange={(on) => onChange({ hasDefault: on !== true })}
              />
              {t('onlyForSomeChoices')}
            </label>
          )}
        </div>
      )}

      {slot.groupIds.length > 0 && (
        <OverrideEditor
          slot={slot}
          menu={menu}
          options={options}
          byValue={byValue}
          onChange={(overrides) => onChange({ overrides })}
        />
      )}
    </div>
  )
}

function QuantityInput({
  value,
  unit,
  placeholder,
  disabled,
  compact,
  onChange,
}: {
  value: string
  unit: string
  placeholder?: string
  disabled?: boolean
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
        placeholder={placeholder ?? t('quantity')}
        aria-label={t('quantity')}
        className={cn(compact ? 'h-7 text-xs' : 'h-8', unit && 'pe-9')}
        value={value}
        disabled={disabled}
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

/** Which option groups a slot depends on; one or two give a grid, more a list */
function DependsOnPicker({
  menu,
  value,
  onChange,
}: {
  menu: MenuOptions
  value: string[]
  onChange: (groupIds: string[]) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const chosen = menu.groups.filter((g) => value.includes(g.id))
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          className='h-8 max-w-56 justify-between text-xs font-normal'
        >
          <span className='truncate'>
            {chosen.length === 0
              ? t('sameForEveryChoice')
              : t('dependsOn', {
                  groups: chosen.map((g) => g.label).join(' × '),
                })}
          </span>
          <ChevronsUpDown className='ms-1 h-3.5 w-3.5 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-60 space-y-2 p-3' align='start'>
        <p className='text-muted-foreground text-xs'>{t('dependsOnHint')}</p>
        {menu.groups.map((group) => (
          <label
            key={group.id}
            className='flex cursor-pointer items-center gap-2 text-sm'
          >
            <Checkbox
              checked={value.includes(group.id)}
              onCheckedChange={(on) =>
                onChange(
                  on === true
                    ? menu.groups
                        .map((g) => g.id)
                        .filter((id) => id === group.id || value.includes(id))
                    : value.filter((id) => id !== group.id)
                )
              }
            />
            {group.label}
            {group.allowMultiple && (
              <span className='text-muted-foreground text-xs'>
                {t('addOns')}
              </span>
            )}
          </label>
        ))}
      </PopoverContent>
    </Popover>
  )
}

/**
 * The cells: one per option (one group), per pair (two groups), or a
 * plain list of rules (three or more). A cell says what the slot becomes
 * for that choice: another item, another amount, or nothing; empty means
 * the default.
 */
function OverrideEditor({
  slot,
  menu,
  options,
  byValue,
  onChange,
}: {
  slot: SlotDraft
  menu: MenuOptions
  options: ComboboxOption[]
  byValue: Map<string, IngredientOption>
  onChange: (overrides: OverrideDraft[]) => void
}) {
  const t = useT()
  const groups = slot.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => !!g)

  const find = (combo: string[]) =>
    slot.overrides.find(
      (o) => optionSetKey(o.optionIds) === optionSetKey(combo)
    )

  const set = (combo: string[], patch: Partial<OverrideDraft>) => {
    const existing = find(combo)
    const next: OverrideDraft = {
      ...(existing ?? {
        key: draftKey(),
        optionIds: [...combo],
        stockItemId: null,
        quantity: '',
        none: false,
      }),
      ...patch,
    }
    const kept = slot.overrides.filter((o) => o.key !== next.key)
    onChange(overrideHasContent(next) ? [...kept, next] : kept)
  }

  const cell = (combo: string[]) => (
    <OverrideCell
      slot={slot}
      override={find(combo)}
      options={options}
      byValue={byValue}
      onChange={(patch) => set(combo, patch)}
    />
  )

  if (groups.length === 1) {
    const [group] = groups
    return (
      <div className='space-y-1.5 border-t p-2'>
        {group.options.map((option) => (
          <div
            key={option.id}
            className='grid items-start gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'
          >
            <span className='pt-1.5 text-xs'>{optionLabel(option, t)}</span>
            {cell([option.id])}
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 2) {
    const [rows, cols] = groups
    return (
      <div className='overflow-x-auto border-t p-2'>
        <table className='w-full text-xs'>
          <thead>
            <tr>
              <th className='text-muted-foreground w-28 pb-1 text-start font-normal'>
                {rows.label} ↓ {cols.label} →
              </th>
              {cols.options.map((c) => (
                <th key={c.id} className='min-w-40 pb-1 text-start font-medium'>
                  {optionLabel(c, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.options.map((r) => (
              <tr key={r.id} className='border-t'>
                <td className='py-1.5 pe-2 align-top font-medium'>
                  {optionLabel(r, t)}
                </td>
                {cols.options.map((c) => (
                  <td key={c.id} className='py-1.5 pe-2 align-top'>
                    {cell([r.id, c.id])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Three groups or more: one row per rule, a column per group
  const sorted = [...slot.overrides].sort((a, b) => {
    for (const g of groups) {
      const ia = g.options.findIndex((o) => a.optionIds.includes(o.id))
      const ib = g.options.findIndex((o) => b.optionIds.includes(o.id))
      if (ia !== ib) return ia - ib
    }
    return 0
  })
  return (
    <div className='overflow-x-auto border-t p-2'>
      <table className='w-full text-xs'>
        <thead>
          <tr>
            {groups.map((g) => (
              <th key={g.id} className='pe-2 pb-1 text-start font-medium'>
                {g.label}
              </th>
            ))}
            <th className='min-w-40 pe-2 pb-1 text-start font-medium'>
              {t('stockItem')}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((o) => (
            <tr key={o.key} className='border-t'>
              {groups.map((g) => (
                <td key={g.id} className='py-1 pe-2 align-middle'>
                  {g.options.find((x) => o.optionIds.includes(x.id))?.label ??
                    '?'}
                </td>
              ))}
              <td className='py-1 pe-2 align-middle'>
                <OverrideCell
                  slot={slot}
                  override={o}
                  options={options}
                  byValue={byValue}
                  onChange={(patch) => set(o.optionIds, patch)}
                />
              </td>
              <td className='py-1 align-middle'>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='size-7'
                  aria-label={t('removeLine')}
                  onClick={() =>
                    onChange(slot.overrides.filter((x) => x.key !== o.key))
                  }
                >
                  <X className='h-3.5 w-3.5' />
                </Button>
              </td>
            </tr>
          ))}
          <tr className='border-t'>
            <td colSpan={groups.length + 2} className='pt-2'>
              <RuleAdder groups={groups} onAdd={(combo) => set(combo, {})} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function OverrideCell({
  slot,
  override,
  options,
  byValue,
  onChange,
}: {
  slot: SlotDraft
  override: OverrideDraft | undefined
  options: ComboboxOption[]
  byValue: Map<string, IngredientOption>
  onChange: (patch: Partial<OverrideDraft>) => void
}) {
  const t = useT()
  const none = override?.none ?? false
  const itemId = override?.stockItemId ?? slot.stockItemId
  const unit = itemId ? (byValue.get(itemId)?.unit ?? '') : ''
  const defaultLabel = slot.stockItemId
    ? byValue.get(slot.stockItemId)?.label
    : undefined

  return (
    <div className={cn('space-y-1', none && 'opacity-60')}>
      <Combobox
        value={override?.stockItemId ?? null}
        onChange={(value) => onChange({ stockItemId: value })}
        options={options}
        placeholder={
          slot.hasDefault && defaultLabel ? defaultLabel : t('pickStockItem')
        }
        disabled={none}
        size='sm'
        wrap
      />
      <div className='flex items-center gap-1'>
        <QuantityInput
          value={override?.quantity ?? ''}
          unit={unit}
          placeholder={
            slot.hasDefault && slot.quantity ? slot.quantity : undefined
          }
          disabled={none}
          compact
          onChange={(quantity) => onChange({ quantity })}
        />
        <Button
          type='button'
          variant={none ? 'secondary' : 'ghost'}
          size='icon'
          className={cn('size-7 shrink-0', none && 'text-destructive')}
          aria-label={t('deductNothing')}
          title={none ? t('deductNothingOn') : t('deductNothing')}
          aria-pressed={none}
          onClick={() => onChange({ none: !none })}
        >
          <Ban className='h-3.5 w-3.5' />
        </Button>
      </div>
    </div>
  )
}

/** For a slot on three or more groups: pick one option per group to add a rule for */
function RuleAdder({
  groups,
  onAdd,
}: {
  groups: MenuGroup[]
  onAdd: (combo: string[]) => void
}) {
  const t = useT()
  const [picked, setPicked] = useState<Record<string, string>>({})
  const complete = groups.every((g) => picked[g.id])
  return (
    <div className='flex flex-wrap items-center gap-2'>
      {groups.map((group) => (
        <Select
          key={group.id}
          value={picked[group.id] ?? ''}
          onValueChange={(value) =>
            setPicked((prev) => ({ ...prev, [group.id]: value }))
          }
        >
          <SelectTrigger className='h-7 w-36 text-xs' aria-label={group.label}>
            <SelectValue placeholder={group.label} />
          </SelectTrigger>
          <SelectContent>
            {group.options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      <Button
        type='button'
        variant='ghost'
        size='sm'
        className='h-7 px-2 text-xs'
        disabled={!complete}
        onClick={() => {
          onAdd(groups.map((g) => picked[g.id]))
          setPicked({})
        }}
      >
        <Plus className='me-1 h-3.5 w-3.5' />
        {t('addRule')}
      </Button>
    </div>
  )
}

/** The size row: pick the group that is the size, give each of its options a factor */
function ScaleEditor({
  draft,
  onChange,
  menu,
}: {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
}) {
  const t = useT()
  const single = menu.groups.filter((g) => !g.allowMultiple)
  const current = single.find((g) =>
    g.options.some((o) => draft.scales.some((s) => s.optionId === o.id))
  )

  const pickGroup = (groupId: string) => {
    const group = single.find((g) => g.id === groupId)
    onChange({
      ...draft,
      scales: group
        ? group.options.map((o) => ({ optionId: o.id, factor: '1' }))
        : [],
    })
  }

  return (
    <div className='space-y-2 rounded-lg border p-2'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <Maximize2 className='text-muted-foreground size-4' aria-hidden />
        <span className='font-medium'>{t('sizeFactors')}</span>
        <Select value={current?.id ?? 'none'} onValueChange={pickGroup}>
          <SelectTrigger
            className='h-8 w-44 text-xs'
            aria-label={t('sizeFactors')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='none'>{t('noSizeGroup')}</SelectItem>
            {single.map((g) => (
              <SelectItem key={g.id} value={g.id}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {current ? (
        <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
          {current.options.map((o) => {
            const scale = draft.scales.find((s) => s.optionId === o.id)
            return (
              <label key={o.id} className='flex items-center gap-1.5 text-xs'>
                <span className='max-w-28 truncate'>{o.label}</span>
                <span className='text-muted-foreground'>×</span>
                <Input
                  type='number'
                  min='0'
                  step='any'
                  className='h-7 w-16 text-xs tabular-nums'
                  value={scale?.factor ?? '1'}
                  onChange={(e) =>
                    onChange({
                      ...draft,
                      scales: draft.scales.map((s) =>
                        s.optionId === o.id
                          ? { ...s, factor: e.target.value }
                          : s
                      ),
                    })
                  }
                />
              </label>
            )
          })}
        </div>
      ) : (
        <p className='text-muted-foreground text-xs'>{t('sizeFactorsHint')}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Try it: pick like the cashier, see what comes off the shelf

export type StockInfo = { label: string; unit: string }

/**
 * The deduction the API would post for one unit sold with these options,
 * resolved the way the till resolves it. Folded away until asked for: it
 * is a check, not part of the recipe.
 */
export function DeductionPreview({
  lines,
  scales,
  menu,
  stock,
}: {
  lines: SlotLine[]
  scales: SlotScale[]
  menu: MenuOptions
  stock: Map<string, StockInfo>
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() =>
    menu.groups
      .flatMap((g) => g.options.filter((o) => o.isDefault))
      .map((o) => o.id)
  )

  if (menu.groups.length === 0) return null

  const chosenSet = new Set(chosen)
  const totals = resolve(lines, scales, chosenSet)

  const pickGroup = (group: MenuGroup, values: string[]) => {
    const siblings = new Set(group.options.map((o) => o.id))
    setChosen((prev) => [...prev.filter((id) => !siblings.has(id)), ...values])
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='text-muted-foreground h-7 px-2'
        >
          <FlaskConical className='me-1 h-3.5 w-3.5' />
          {t('tryIt')}
          <ChevronDown
            className={cn(
              'ms-1 h-3.5 w-3.5 transition-transform',
              open && 'rotate-180'
            )}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className='mt-2 space-y-3 rounded-lg border p-3'>
        <p className='text-muted-foreground text-xs'>{t('tryItHint')}</p>
        <div className='space-y-2'>
          {menu.groups.map((group) => {
            const inGroup = group.options
              .map((o) => o.id)
              .filter((id) => chosenSet.has(id))
            const items = group.options.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className='data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-2.5 text-xs'
              >
                {option.label}
              </ToggleGroupItem>
            ))
            return (
              <div
                key={group.id}
                className='flex flex-wrap items-center gap-x-3 gap-y-1'
              >
                <span className='text-muted-foreground w-24 shrink-0 truncate text-xs'>
                  {group.label}
                </span>
                {group.allowMultiple ? (
                  <ToggleGroup
                    type='multiple'
                    variant='outline'
                    size='sm'
                    value={inGroup}
                    onValueChange={(values) => pickGroup(group, values)}
                    className='flex-wrap'
                  >
                    {items}
                  </ToggleGroup>
                ) : (
                  <ToggleGroup
                    type='single'
                    variant='outline'
                    size='sm'
                    value={inGroup[0] ?? ''}
                    onValueChange={(value) =>
                      pickGroup(group, value ? [value] : [])
                    }
                    className='flex-wrap'
                  >
                    {items}
                  </ToggleGroup>
                )}
              </div>
            )
          })}
        </div>
        {totals.size === 0 ? (
          <p className='text-muted-foreground text-sm'>
            {t('nothingDeducted')}
          </p>
        ) : (
          <ul className='space-y-1 text-sm'>
            {[...totals].map(([stockItemId, quantity]) => {
              const info = stock.get(stockItemId)
              return (
                <li
                  key={stockItemId}
                  className='flex flex-wrap items-baseline gap-x-2'
                >
                  <span className='font-medium'>{info?.label ?? '—'}</span>
                  <span className='tabular-nums'>
                    {formatQuantity(quantity, info?.unit ?? '', t)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
