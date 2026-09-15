import { useState } from 'react'
import { Ban, Maximize2, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { unitLabel } from '@/features/inventory/format'
import {
  draftKey,
  newSlot,
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
 * The recipe the way the admin thinks: first what a plain sale takes,
 * then one question per option group — does الحجم multiply it? does
 * التحميص change which bag? does السكر change an amount? is the cup
 * only for some choices? Every answer is written straight into the slot
 * draft, so what the till deducts is exactly what the card says. Bags are
 * guessed from their names (the default bag with وسط swapped for فاتح);
 * anything this page cannot express is left to the advanced editor.
 */
type Props = {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
  ingredients: IngredientOption[]
}

type Mode =
  | 'none'
  | 'multiply'
  | 'amount'
  | 'item'
  | 'only'
  | 'addon'
  | 'advanced'

type Usage =
  | { mode: 'none' | 'multiply' | 'advanced' }
  | { mode: 'amount' | 'only'; slot: SlotDraft }
  | { mode: 'item'; slot: SlotDraft; partner?: MenuGroup }
  | { mode: 'addon'; slots: SlotDraft[] }

export function RecipeBuilder({ draft, onChange, menu, ingredients }: Props) {
  const t = useT()
  const [advanced, setAdvanced] = useState(false)
  const byValue = new Map(ingredients.map((i) => [i.value, i]))
  const options: ComboboxOption[] = ingredients.map((i) => ({
    value: i.value,
    label: i.label,
    hint: unitLabel(i.unit, t),
  }))
  const rows = draft.slots.filter((s) => s.hasDefault)
  // The sale the rows describe: the default option of every single-choice group
  const standardNames = menu.groups
    .filter((g) => !g.allowMultiple)
    .map((g) => g.options.find((o) => o.isDefault)?.label)
    .filter((l): l is string => !!l)
  const rowLabel = (slot: SlotDraft) =>
    slot.stockItemId
      ? (byValue.get(slot.stockItemId)?.label ?? '?')
      : t('pickStockItem')

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
          onClick={() => setAdvanced(false)}
        >
          {t('simpleEditor')}
        </Button>
      </div>
    )
  }

  const updateSlot = (key: number, patch: Partial<SlotDraft>) =>
    onChange({
      ...draft,
      slots: draft.slots.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    })

  // The partner of a pair grid is drawn inside the first group's card
  const usages = new Map(
    menu.groups.map((g) => [g.id, usageOf(draft, g, menu)])
  )
  const drawnAsPartner = new Set<string>()
  for (const group of menu.groups) {
    const usage = usages.get(group.id)
    if (
      usage?.mode === 'item' &&
      usage.partner &&
      !drawnAsPartner.has(group.id)
    ) {
      drawnAsPartner.add(usage.partner.id)
    }
  }

  return (
    <div className='space-y-4'>
      <section className='space-y-2'>
        <h4 className='text-sm font-medium'>{t('standardChoiceTakes')}</h4>
        <p className='text-muted-foreground text-xs'>
          {standardNames.length > 0
            ? t('standardChoiceIs', { choices: standardNames.join(' · ') })
            : t('plainSaleHint')}
        </p>
        <div className='space-y-2'>
          {rows.map((slot) => (
            <div
              key={slot.key}
              className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center'
            >
              <Combobox
                value={slot.stockItemId}
                onChange={(value) =>
                  updateSlot(slot.key, { stockItemId: value })
                }
                options={options}
                placeholder={t('pickStockItem')}
                size='sm'
                wrap
              />
              <Quantity
                value={slot.quantity}
                unit={
                  slot.stockItemId
                    ? (byValue.get(slot.stockItemId)?.unit ?? '')
                    : ''
                }
                onChange={(quantity) => updateSlot(slot.key, { quantity })}
              />
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='size-8 justify-self-end'
                aria-label={t('removeLine')}
                onClick={() =>
                  onChange({
                    ...draft,
                    slots: draft.slots.filter((s) => s.key !== slot.key),
                  })
                }
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>
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
      </section>

      {menu.groups.length > 0 && rows.length > 0 && (
        <section className='space-y-2'>
          <h4 className='text-sm font-medium'>{t('choicesThatChangeIt')}</h4>
          <p className='text-muted-foreground text-xs'>{t('choicesHint')}</p>
          {menu.groups.map((group) => {
            const usage = usages.get(group.id) ?? { mode: 'none' }
            const partnerOf = menu.groups.find((g) => {
              const u = usages.get(g.id)
              return (
                u?.mode === 'item' &&
                u.partner?.id === group.id &&
                !drawnAsPartner.has(g.id)
              )
            })
            return (
              <GroupCard
                key={group.id}
                group={group}
                usage={usage}
                drawnInside={partnerOf}
                draft={draft}
                rows={rows}
                rowLabel={rowLabel}
                menu={menu}
                options={options}
                byValue={byValue}
                ingredients={ingredients}
                onChange={onChange}
                onAdvanced={() => setAdvanced(true)}
              />
            )
          })}
        </section>
      )}

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
  )
}

// ---------------------------------------------------------------------------
// Reading the draft per group

function usageOf(
  draft: RecipeDraft,
  group: MenuGroup,
  menu: MenuOptions
): Usage {
  const ids = new Set(group.options.map((o) => o.id))
  if (draft.scales.some((s) => ids.has(s.optionId))) return { mode: 'multiply' }

  const involved = draft.slots.filter((s) =>
    s.overrides.some(
      (o) => overrideHasContent(o) && o.optionIds.some((id) => ids.has(id))
    )
  )
  if (involved.length === 0) return { mode: 'none' }

  if (group.allowMultiple) {
    // Each add-on is a slot of its own with no default and one override on that option
    const ok = involved.every(
      (s) =>
        !s.hasDefault &&
        s.overrides.filter(overrideHasContent).length === 1 &&
        s.overrides[0].optionIds.length === 1 &&
        ids.has(s.overrides[0].optionIds[0]) &&
        !s.overrides[0].none
    )
    return ok ? { mode: 'addon', slots: involved } : { mode: 'advanced' }
  }

  if (involved.length > 1) return { mode: 'advanced' }
  const slot = involved[0]
  if (!slot.hasDefault) return { mode: 'advanced' }
  const overs = slot.overrides.filter(
    (o) => overrideHasContent(o) && o.optionIds.some((id) => ids.has(id))
  )
  const singles = overs.filter((o) => o.optionIds.length === 1)
  const pairs = overs.filter((o) => o.optionIds.length === 2)
  if (singles.length + pairs.length !== overs.length)
    return { mode: 'advanced' }

  if (pairs.length > 0 && singles.length === 0) {
    const others = new Set(
      pairs.flatMap((o) => o.optionIds.filter((id) => !ids.has(id)))
    )
    const partners = menu.groups.filter(
      (g) => g.id !== group.id && g.options.some((o) => others.has(o.id))
    )
    if (partners.length !== 1) return { mode: 'advanced' }
    if (!pairs.every((o) => o.stockItemId !== null && !o.none))
      return { mode: 'advanced' }
    return { mode: 'item', slot, partner: partners[0] }
  }
  if (pairs.length > 0) return { mode: 'advanced' }

  if (singles.every((o) => o.none)) return { mode: 'only', slot }
  if (
    singles.every(
      (o) => o.none || (o.stockItemId === null && o.quantity.trim() !== '')
    )
  ) {
    return { mode: 'amount', slot }
  }
  if (
    singles.every(
      (o) => o.stockItemId !== null && o.quantity.trim() === '' && !o.none
    )
  ) {
    return { mode: 'item', slot }
  }
  return { mode: 'advanced' }
}

// ---------------------------------------------------------------------------
// Writing the draft per group

/** The group's marks taken out of the draft: overrides, factors, add-on slots; a pair grid collapses to the partner's singles */
function clearGroup(draft: RecipeDraft, group: MenuGroup): RecipeDraft {
  const ids = new Set(group.options.map((o) => o.id))
  const slots = draft.slots
    .map((slot) => {
      const kept: OverrideDraft[] = []
      const pairs: OverrideDraft[] = []
      for (const o of slot.overrides) {
        if (!o.optionIds.some((id) => ids.has(id))) kept.push(o)
        else if (o.optionIds.length === 2) pairs.push(o)
      }
      if (pairs.length > 0) {
        // Keep the partner's own column: the cells on this group's default option
        const defaultId = group.options.find((o) => o.isDefault)?.id
        for (const pair of pairs) {
          if (defaultId && !pair.optionIds.includes(defaultId)) continue
          const other = pair.optionIds.find((id) => !ids.has(id))
          if (!other || kept.some((k) => optionSetKey(k.optionIds) === other))
            continue
          kept.push({ ...pair, key: draftKey(), optionIds: [other] })
        }
      }
      return {
        ...slot,
        overrides: kept,
        groupIds: slot.groupIds.filter((g) => g !== group.id),
      }
    })
    .filter(
      (slot) => slot.hasDefault || slot.overrides.some(overrideHasContent)
    )
  return {
    slots,
    scales: draft.scales.filter((s) => !ids.has(s.optionId)),
  }
}

function setOverride(
  draft: RecipeDraft,
  slotKey: number,
  optionIds: string[],
  patch: Partial<OverrideDraft> | null,
  groupIds: string[]
): RecipeDraft {
  return {
    ...draft,
    slots: draft.slots.map((slot) => {
      if (slot.key !== slotKey) return slot
      const key = optionSetKey(optionIds)
      const existing = slot.overrides.find(
        (o) => optionSetKey(o.optionIds) === key
      )
      const rest = slot.overrides.filter(
        (o) => optionSetKey(o.optionIds) !== key
      )
      const next: OverrideDraft | null = patch
        ? {
            ...(existing ?? {
              key: draftKey(),
              optionIds: [...optionIds],
              stockItemId: null,
              quantity: '',
              none: false,
            }),
            ...patch,
          }
        : null
      return {
        ...slot,
        groupIds: Array.from(new Set([...slot.groupIds, ...groupIds])),
        overrides: next && overrideHasContent(next) ? [...rest, next] : rest,
      }
    }),
  }
}

/** What "large" or "double" probably means, from the option's name */
function guessFactor(option: MenuOption): string {
  const names = option.names.map((n) => n.toLowerCase())
  if (names.some((n) => /double|دبل|دوبل/.test(n))) return '2'
  if (names.some((n) => /triple|تريبل/.test(n))) return '3'
  if (names.some((n) => /large|كبير|لارج/.test(n))) return '1.5'
  return '1'
}

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

/**
 * The bag for a choice, guessed from the default bag's name: "بن تركي وسط
 * سادة" with وسط swapped for فاتح is "بن تركي فاتح سادة" — if that is on
 * the shelf, it is the answer. Several swaps at once for a pair grid.
 */
export function guessItem(
  base: IngredientOption,
  swaps: Array<{ from: MenuOption; to: MenuOption }>,
  ingredients: IngredientOption[]
): string | null {
  const byName = new Map<string, string>()
  for (const i of ingredients)
    for (const n of i.names) byName.set(fold(n), i.value)

  const expand = (name: string, index: number): string[] => {
    if (index >= swaps.length) return [name]
    const { from, to } = swaps[index]
    const out: string[] = []
    for (const f of from.names) {
      if (!name.includes(f)) continue
      for (const toName of to.names)
        out.push(...expand(name.replace(f, toName), index + 1))
    }
    return out
  }
  for (const name of base.names) {
    for (const candidate of expand(name, 0)) {
      const hit = byName.get(fold(candidate))
      if (hit && hit !== base.value) return hit
    }
  }
  // Fallback: an item whose name carries every wanted word and the base's first word
  const first = fold(base.names[0] ?? '').split(' ')[0]
  const wanted = swaps.map((s) => s.to.names.map(fold))
  const fallback = ingredients.find(
    (i) =>
      i.value !== base.value &&
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
// One card per option group

function GroupCard({
  group,
  usage,
  drawnInside,
  draft,
  rows,
  rowLabel,
  menu,
  options,
  byValue,
  ingredients,
  onChange,
  onAdvanced,
}: {
  group: MenuGroup
  usage: Usage
  /** Set when this group's pair grid is drawn inside that group's card */
  drawnInside: MenuGroup | undefined
  draft: RecipeDraft
  rows: SlotDraft[]
  rowLabel: (slot: SlotDraft) => string
  menu: MenuOptions
  options: ComboboxOption[]
  byValue: Map<string, IngredientOption>
  ingredients: IngredientOption[]
  onChange: (draft: RecipeDraft) => void
  onAdvanced: () => void
}) {
  const t = useT()
  const defaultOption = group.options.find((o) => o.isDefault)
  const mode: Mode = usage.mode
  const targetSlot = 'slot' in usage ? usage.slot : undefined

  const preferredRow = (want: 'weight' | 'pieces'): SlotDraft =>
    rows.find((r) => {
      const unit = r.stockItemId ? byValue.get(r.stockItemId)?.unit : ''
      return want === 'pieces' ? unit === 'pcs' : unit !== 'pcs'
    }) ?? rows[0]

  const setMode = (next: Mode) => {
    let d = clearGroup(draft, group)
    if (next === 'multiply') {
      d = {
        ...d,
        scales: [
          ...d.scales,
          ...group.options.map((o) => ({
            optionId: o.id,
            factor: o.isDefault ? '1' : guessFactor(o),
          })),
        ],
      }
    } else if (next === 'item') {
      d = withItemMode(d, preferredRow('weight'))
    } else if (next === 'amount') {
      const row = preferredRow('weight')
      d = {
        ...d,
        slots: d.slots.map((s) =>
          s.key === row.key ? { ...s, groupIds: [...s.groupIds, group.id] } : s
        ),
      }
    } else if (next === 'only') {
      const row = preferredRow('pieces')
      d = {
        ...d,
        slots: d.slots.map((s) =>
          s.key === row.key ? { ...s, groupIds: [...s.groupIds, group.id] } : s
        ),
      }
    }
    onChange(d)
  }

  /** Item mode on a row: guess each choice's item; with a partner already there, a pair grid */
  const withItemMode = (d: RecipeDraft, row: SlotDraft): RecipeDraft => {
    const base = row.stockItemId ? byValue.get(row.stockItemId) : undefined
    const partnerUsage = menu.groups
      .map((g) => ({ g, u: usageOf(d, g, menu) }))
      .find(
        ({ g, u }) =>
          g.id !== group.id &&
          u.mode === 'item' &&
          u.slot.key === row.key &&
          !u.partner
      )
    let next = {
      ...d,
      slots: d.slots.map((s) =>
        s.key === row.key ? { ...s, groupIds: [...s.groupIds, group.id] } : s
      ),
    }
    if (!defaultOption) return next
    if (partnerUsage) {
      // The partner's singles become a grid keyed on both groups
      const partner = partnerUsage.g
      const partnerDefault = partner.options.find((o) => o.isDefault)
      const singles = new Map(
        row.overrides
          .filter((o) => o.optionIds.length === 1)
          .map((o) => [o.optionIds[0], o.stockItemId])
      )
      for (const p of partner.options) {
        next = setOverride(next, row.key, [p.id], null, [])
      }
      for (const g of group.options) {
        for (const p of partner.options) {
          if (g.isDefault && p.isDefault) continue
          let item: string | null = null
          if (g.isDefault) item = singles.get(p.id) ?? null
          else if (base && partnerDefault) {
            item = guessItem(
              base,
              p.isDefault
                ? [{ from: defaultOption, to: g }]
                : [
                    { from: defaultOption, to: g },
                    { from: partnerDefault, to: p },
                  ],
              ingredients
            )
          }
          if (item)
            next = setOverride(
              next,
              row.key,
              [g.id, p.id],
              { stockItemId: item },
              [group.id, partner.id]
            )
        }
      }
      return next
    }
    for (const o of group.options) {
      if (o.isDefault || !base) continue
      const item = guessItem(
        base,
        [{ from: defaultOption, to: o }],
        ingredients
      )
      if (item)
        next = setOverride(next, row.key, [o.id], { stockItemId: item }, [
          group.id,
        ])
    }
    return next
  }

  const retarget = (slotKey: string) => {
    const row = rows.find((r) => String(r.key) === slotKey)
    if (!row || !targetSlot) return
    let d = clearGroup(draft, group)
    if (mode === 'item') d = withItemMode(d, row)
    else
      d = {
        ...d,
        slots: d.slots.map((s) =>
          s.key === row.key ? { ...s, groupIds: [...s.groupIds, group.id] } : s
        ),
      }
    onChange(d)
  }

  const modes: Array<{ value: Mode; label: string }> = group.allowMultiple
    ? [
        { value: 'none', label: t('modeNone') },
        { value: 'addon', label: t('modeAddon') },
      ]
    : [
        { value: 'none', label: t('modeNone') },
        { value: 'multiply', label: t('modeMultiply') },
        { value: 'amount', label: t('modeAmount') },
        { value: 'item', label: t('modeItem') },
        { value: 'only', label: t('modeOnly') },
      ]

  return (
    <div className='rounded-lg border'>
      <div className='flex flex-wrap items-center gap-2 border-b px-3 py-2'>
        <span className='min-w-24 text-sm font-medium'>{group.label}</span>
        {mode === 'advanced' ? (
          <Badge variant='outline' className='gap-1 font-normal'>
            {t('customRules')}
            <button type='button' className='underline' onClick={onAdvanced}>
              {t('advancedEditor')}
            </button>
          </Badge>
        ) : (
          <ToggleGroup
            type='single'
            size='sm'
            variant='outline'
            value={mode}
            onValueChange={(value) => value && setMode(value as Mode)}
            className='flex-wrap'
          >
            {modes.map((m) => (
              <ToggleGroupItem
                key={m.value}
                value={m.value}
                className='h-7 px-2 text-xs'
              >
                {m.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      </div>

      {mode === 'multiply' && (
        <div className='space-y-2 px-3 py-2'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            {group.options.map((o) => {
              const scale = draft.scales.find((s) => s.optionId === o.id)
              return (
                <label key={o.id} className='flex items-center gap-1.5 text-xs'>
                  <span className='max-w-32 truncate'>{o.label}</span>
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
          <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs'>
            <Maximize2 className='size-3' aria-hidden />
            <span>{t('growsWith')}:</span>
            {rows.map((row) => (
              <label
                key={row.key}
                className='flex cursor-pointer items-center gap-1'
              >
                <Checkbox
                  checked={row.scalable}
                  onCheckedChange={(on) =>
                    onChange({
                      ...draft,
                      slots: draft.slots.map((s) =>
                        s.key === row.key ? { ...s, scalable: on === true } : s
                      ),
                    })
                  }
                />
                {rowLabel(row)}
              </label>
            ))}
          </div>
        </div>
      )}

      {(mode === 'amount' || mode === 'item' || mode === 'only') &&
        targetSlot && (
          <div className='space-y-2 px-3 py-2'>
            <div className='flex flex-wrap items-center gap-2 text-xs'>
              <span className='text-muted-foreground'>
                {mode === 'amount'
                  ? t('amountOf')
                  : mode === 'item'
                    ? t('itemOf')
                    : t('onlyFor')}
              </span>
              <Select value={String(targetSlot.key)} onValueChange={retarget}>
                <SelectTrigger className='h-7 w-48 text-xs'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((row) => (
                    <SelectItem key={row.key} value={String(row.key)}>
                      {rowLabel(row)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mode === 'item' &&
                'partner' in usage &&
                usage.partner &&
                drawnInside === undefined && (
                  <span className='text-muted-foreground'>
                    {t('withGroup', { group: usage.partner.label })}
                  </span>
                )}
            </div>

            {mode === 'amount' && (
              <div className='flex flex-wrap gap-x-4 gap-y-2'>
                {group.options.map((o) => {
                  const override = targetSlot.overrides.find(
                    (x) => optionSetKey(x.optionIds) === o.id
                  )
                  const value = override?.none
                    ? '0'
                    : (override?.quantity ?? '')
                  const unit = targetSlot.stockItemId
                    ? (byValue.get(targetSlot.stockItemId)?.unit ?? '')
                    : ''
                  return (
                    <label
                      key={o.id}
                      className='flex items-center gap-1.5 text-xs'
                    >
                      <span className='max-w-32 truncate'>{o.label}</span>
                      <Quantity
                        value={o.isDefault ? targetSlot.quantity : value}
                        unit={unit}
                        placeholder={targetSlot.quantity}
                        disabled={o.isDefault}
                        compact
                        onChange={(v) =>
                          onChange(
                            setOverride(
                              draft,
                              targetSlot.key,
                              [o.id],
                              v.trim() === ''
                                ? null
                                : parseFloat(v) === 0
                                  ? {
                                      none: true,
                                      quantity: '',
                                      stockItemId: null,
                                    }
                                  : {
                                      none: false,
                                      quantity: v,
                                      stockItemId: null,
                                    },
                              [group.id]
                            )
                          )
                        }
                      />
                      {value === '0' && (
                        <Ban
                          className='text-muted-foreground size-3'
                          aria-hidden
                        />
                      )}
                    </label>
                  )
                })}
              </div>
            )}

            {mode === 'item' && !('partner' in usage && usage.partner) && (
              <div className='grid gap-2 sm:grid-cols-2'>
                {group.options.map((o) => {
                  const override = targetSlot.overrides.find(
                    (x) => optionSetKey(x.optionIds) === o.id
                  )
                  return (
                    <div
                      key={o.id}
                      className='grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-2 text-xs'
                    >
                      <span className='truncate'>
                        {o.label}
                        {o.isDefault && (
                          <span className='text-muted-foreground'>
                            {' '}
                            ({t('standardChoice')})
                          </span>
                        )}
                      </span>
                      {o.isDefault ? (
                        <span className='text-muted-foreground truncate'>
                          {rowLabel(targetSlot)}
                        </span>
                      ) : (
                        <Combobox
                          value={override?.stockItemId ?? null}
                          onChange={(value) =>
                            onChange(
                              setOverride(
                                draft,
                                targetSlot.key,
                                [o.id],
                                value
                                  ? {
                                      stockItemId: value,
                                      quantity: '',
                                      none: false,
                                    }
                                  : null,
                                [group.id]
                              )
                            )
                          }
                          options={options}
                          placeholder={rowLabel(targetSlot)}
                          size='sm'
                          wrap
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {mode === 'item' &&
              'partner' in usage &&
              usage.partner &&
              drawnInside === undefined && (
                <PairGrid
                  rowsGroup={group}
                  colsGroup={usage.partner}
                  slot={targetSlot}
                  options={options}
                  rowLabel={rowLabel}
                  onCell={(combo, value) =>
                    onChange(
                      setOverride(
                        draft,
                        targetSlot.key,
                        combo,
                        value
                          ? { stockItemId: value, quantity: '', none: false }
                          : null,
                        [group.id, usage.partner!.id]
                      )
                    )
                  }
                />
              )}

            {mode === 'only' && (
              <div className='flex flex-wrap gap-x-4 gap-y-2'>
                {group.options.map((o) => {
                  const override = targetSlot.overrides.find(
                    (x) => optionSetKey(x.optionIds) === o.id
                  )
                  const present = !override?.none
                  return (
                    <label
                      key={o.id}
                      className='flex cursor-pointer items-center gap-1.5 text-xs'
                    >
                      <Checkbox
                        checked={present}
                        onCheckedChange={(on) =>
                          onChange(
                            setOverride(
                              draft,
                              targetSlot.key,
                              [o.id],
                              on === true
                                ? null
                                : {
                                    none: true,
                                    stockItemId: null,
                                    quantity: '',
                                  },
                              [group.id]
                            )
                          )
                        }
                      />
                      {o.label}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        )}

      {mode === 'item' && drawnInside && (
        <p className='text-muted-foreground px-3 py-2 text-xs'>
          {t('drawnWithGroup', { group: drawnInside.label })}
        </p>
      )}

      {mode === 'addon' && (
        <div className='space-y-2 px-3 py-2'>
          <p className='text-muted-foreground text-xs'>{t('addonHint')}</p>
          {group.options.map((o) => {
            const slot =
              'slots' in usage
                ? usage.slots.find((s) => s.overrides[0]?.optionIds[0] === o.id)
                : undefined
            const override = slot?.overrides[0]
            const unit = override?.stockItemId
              ? (byValue.get(override.stockItemId)?.unit ?? '')
              : ''
            const write = (patch: {
              stockItemId?: string | null
              quantity?: string
            }) => {
              const stockItemId =
                patch.stockItemId !== undefined
                  ? patch.stockItemId
                  : (override?.stockItemId ?? null)
              const quantity =
                patch.quantity !== undefined
                  ? patch.quantity
                  : (override?.quantity ?? '')
              const others = draft.slots.filter((s) => s.key !== slot?.key)
              if (!stockItemId && quantity.trim() === '') {
                onChange({ ...draft, slots: others })
                return
              }
              const next: SlotDraft = {
                ...(slot ?? { ...newSlot(), hasDefault: false }),
                stockItemId: null,
                quantity: '',
                hasDefault: false,
                groupIds: [group.id],
                overrides: [
                  {
                    key: override?.key ?? draftKey(),
                    optionIds: [o.id],
                    stockItemId,
                    quantity,
                    none: false,
                  },
                ],
              }
              onChange({
                ...draft,
                slots: slot
                  ? draft.slots.map((s) => (s.key === slot.key ? next : s))
                  : [...draft.slots, next],
              })
            }
            return (
              <div
                key={o.id}
                className='grid items-center gap-2 text-xs sm:grid-cols-[7rem_minmax(0,1fr)_6rem]'
              >
                <span className='truncate'>{o.label}</span>
                <Combobox
                  value={override?.stockItemId ?? null}
                  onChange={(value) => write({ stockItemId: value })}
                  options={options}
                  placeholder={t('addsNothing')}
                  size='sm'
                  wrap
                />
                <Quantity
                  value={override?.quantity ?? ''}
                  unit={unit}
                  compact
                  onChange={(quantity) => write({ quantity })}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PairGrid({
  rowsGroup,
  colsGroup,
  slot,
  options,
  rowLabel,
  onCell,
}: {
  rowsGroup: MenuGroup
  colsGroup: MenuGroup
  slot: SlotDraft
  options: ComboboxOption[]
  rowLabel: (slot: SlotDraft) => string
  onCell: (combo: string[], value: string | null) => void
}) {
  const t = useT()
  const cell = (combo: string[]) =>
    slot.overrides.find(
      (o) => optionSetKey(o.optionIds) === optionSetKey(combo)
    )
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-xs'>
        <thead>
          <tr>
            <th className='text-muted-foreground w-24 pb-1 text-start font-normal'>
              {rowsGroup.label} ↓ {colsGroup.label} →
            </th>
            {colsGroup.options.map((c) => (
              <th key={c.id} className='min-w-40 pb-1 text-start font-medium'>
                {c.label}
                {c.isDefault && (
                  <span className='text-muted-foreground font-normal'>
                    {' '}
                    ({t('standardChoice')})
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowsGroup.options.map((r) => (
            <tr key={r.id} className='border-t'>
              <td className='py-1.5 pe-2 align-middle font-medium'>
                {r.label}
                {r.isDefault && (
                  <span className='text-muted-foreground font-normal'>
                    {' '}
                    ({t('standardChoice')})
                  </span>
                )}
              </td>
              {colsGroup.options.map((c) => (
                <td key={c.id} className='py-1.5 pe-2 align-middle'>
                  {r.isDefault && c.isDefault ? (
                    <span className='text-muted-foreground'>
                      {rowLabel(slot)}
                    </span>
                  ) : (
                    <Combobox
                      value={cell([r.id, c.id])?.stockItemId ?? null}
                      onChange={(value) => onCell([r.id, c.id], value)}
                      options={options}
                      placeholder={rowLabel(slot)}
                      size='sm'
                      wrap
                    />
                  )}
                </td>
              ))}
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
        className={cn(compact ? 'h-7 w-24 text-xs' : 'h-8', unit && 'pe-8')}
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
