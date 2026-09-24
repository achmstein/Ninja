import { useState } from 'react'
import { CookingPot, Plus, SlidersHorizontal, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  ONE,
  reconstruct,
  resplit,
  resplitItem,
  type BuilderState,
  type IngredientSpec,
  type Varying,
} from '../recipe-cards'
import { RecipeSlotsEditor, type IngredientOption } from './recipe-editor'

/**
 * The recipe the way the admin describes it. Each ingredient answers two
 * things — which item, and how much — and each answer is either one value
 * or, once it is *split* by a choice, one value per combination. Splitting
 * is the only verb, and it sits on the field it applies to as a row of
 * chips, so what a recipe depends on is readable without opening anything.
 * There is no third "when" question: an amount of nothing is how a choice
 * drops an ingredient (سادة takes no sugar). The slot draft the till reads
 * is compiled from the answers (recipe-cards.ts); what the cards cannot
 * express is kept as custom rules for the advanced editor.
 */
type Props = {
  draft: RecipeDraft
  onChange: (draft: RecipeDraft) => void
  menu: MenuOptions
  ingredients: IngredientOption[]
}

/** The groups a value is split by, as the menu has them */
const groupsOf = (varying: Varying<unknown>, menu: MenuOptions): MenuGroup[] =>
  varying.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => !!g)

/** What the menu's choices are, as one string: it changes when a customization is edited */
const menuSignature = (menu: MenuOptions) =>
  menu.groups
    .map((g) => `${g.id}:${g.options.map((o) => o.id).join(',')}`)
    .join('|')

export function RecipeBuilder({ draft, onChange, menu, ingredients }: Props) {
  const t = useT()
  const [advanced, setAdvanced] = useState(false)
  const [state, setState] = useState<BuilderState>(() =>
    reconstruct(draft, menu)
  )

  // The cards hold option ids, so editing a customization on its own page
  // leaves them stale; re-read from the draft when the choices move
  const signature = menuSignature(menu)
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setState(reconstruct(draft, menu))
  }

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
  const add = () =>
    commit({
      ...state,
      ingredients: [...state.ingredients, newIngredient()],
    })

  if (advanced) {
    return (
      <div className='flex flex-col gap-3'>
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
          className='h-auto self-start p-0'
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

  if (state.ingredients.length === 0 && state.custom.length === 0) {
    return (
      <Empty className='border border-dashed'>
        <EmptyHeader>
          <EmptyMedia variant='icon'>
            <CookingPot />
          </EmptyMedia>
          <EmptyTitle>{t('noIngredientsTitle')}</EmptyTitle>
          <EmptyDescription>{t('noIngredientsHint')}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button type='button' onClick={add}>
            <Plus />
            {t('addIngredient')}
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
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
        <Alert>
          <SlidersHorizontal />
          <AlertTitle>
            {t('customRulesCount', { count: state.custom.length })}
          </AlertTitle>
          <AlertDescription>
            <div className='flex flex-wrap items-center gap-4'>
              <Button
                type='button'
                variant='link'
                size='sm'
                className='h-auto p-0'
                onClick={() => setAdvanced(true)}
              >
                {t('advancedEditor')}
              </Button>
              <Button
                type='button'
                variant='link'
                size='sm'
                className='text-muted-foreground h-auto p-0'
                onClick={() => commit({ ...state, custom: [] })}
              >
                {t('dropCustomRules')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className='flex flex-wrap items-center gap-4'>
        <Button type='button' variant='outline' size='sm' onClick={add}>
          <Plus />
          {t('addIngredient')}
        </Button>
        <Button
          type='button'
          variant='link'
          size='sm'
          className='text-muted-foreground h-auto p-0'
          onClick={() => setAdvanced(true)}
        >
          <SlidersHorizontal />
          {t('advancedEditor')}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One card per ingredient: which item, how much — each fixed or split

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
  // An item is decided by exclusive choices only: a sale can carry several
  // options of an add-on group at once, so it cannot name one bag
  const exclusive = menu.groups.filter((g) => !g.allowMultiple)
  // The unit that labels every amount field, blank unless the bags picked
  // so far agree on one
  const picked = Object.values(spec.item.cells).filter((v) => v !== null)
  const units = new Set(picked.map((v) => byValue.get(v)?.unit))
  const unit = units.size === 1 ? (byValue.get(picked[0])?.unit ?? '') : ''
  const itemGroups = groupsOf(spec.item, menu)
  const amountGroups = groupsOf(spec.amount, menu)

  const setItemGroups = (groupIds: string[]) =>
    onChange({ item: resplitItem(spec.item, groupIds, menu, ingredients) })

  // One bag picked in any cell: the empty cells are guessed from its name
  const setItemCell = (key: string, value: string | null) => {
    const cells = { ...spec.item.cells, [key]: value }
    const picked = value ? byValue.get(value) : undefined
    if (picked) {
      for (const combo of combos(itemGroups)) {
        const k = optionSetKey(combo.map((o) => o.id))
        if (!cells[k]) {
          cells[k] = guessCell(picked, combo, itemGroups, ingredients)
        }
      }
    }
    onChange({ item: { ...spec.item, cells } })
  }

  const setAmountCell = (key: string, value: string) =>
    onChange({
      amount: { ...spec.amount, cells: { ...spec.amount.cells, [key]: value } },
    })

  return (
    <Card>
      <CardContent className='flex flex-col gap-6'>
        <FieldRow
          label={t('whichItem')}
          groups={exclusive}
          action={
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={t('removeLine')}
              onClick={onRemove}
            >
              <X />
            </Button>
          }
          split={spec.item.groupIds}
          onSplit={setItemGroups}
          control={
            <Combobox
              value={spec.item.cells[ONE] ?? null}
              onChange={(value) =>
                onChange({ item: { groupIds: [], cells: { [ONE]: value } } })
              }
              options={options}
              placeholder={t('pickStockItem')}
              wrap
            />
          }
          cells={
            itemGroups.length > 0 && (
              <Cells
                groups={itemGroups}
                render={(key) => (
                  <Combobox
                    value={spec.item.cells[key] ?? null}
                    onChange={(v) => setItemCell(key, v)}
                    options={options}
                    placeholder={t('pickStockItem')}
                    wrap
                  />
                )}
              />
            )
          }
        />

        <FieldRow
          label={t('howMuch')}
          // The amount may hang on an add-on too: nothing for a choice is
          // how an ingredient is left out of a sale entirely
          groups={menu.groups}
          split={spec.amount.groupIds}
          onSplit={(groupIds) =>
            onChange({ amount: resplit(spec.amount, groupIds, menu) })
          }
          control={
            <Quantity
              value={spec.amount.cells[ONE] ?? ''}
              unit={unit}
              onChange={(value) =>
                onChange({ amount: { groupIds: [], cells: { [ONE]: value } } })
              }
            />
          }
          cells={
            amountGroups.length > 0 && (
              <Cells
                groups={amountGroups}
                hint={t('zeroMeansNothing')}
                render={(key) => (
                  <Quantity
                    value={spec.amount.cells[key] ?? ''}
                    unit={unit}
                    onChange={(v) => setAmountCell(key, v)}
                  />
                )}
              />
            )
          }
        />
      </CardContent>
    </Card>
  )
}

/**
 * One answer: its label, the chips that split it, the control when it is
 * one value, and the cells when it is not.
 */
function FieldRow({
  label,
  groups,
  split,
  onSplit,
  control,
  cells,
  action,
}: {
  label: string
  groups: MenuGroup[]
  split: string[]
  onSplit: (groupIds: string[]) => void
  control: React.ReactNode
  cells: React.ReactNode
  /** Sits past the chips, clear of them, so it reads as the card's own */
  action?: React.ReactNode
}) {
  const t = useT()
  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-start gap-2'>
        <div className='flex flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2'>
          <Label className='text-sm'>{label}</Label>
          {groups.length > 0 && (
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground text-xs'>
                {t('splitBy')}
              </span>
              <ToggleGroup
                type='multiple'
                variant='outline'
                size='sm'
                value={split}
                onValueChange={onSplit}
              >
                {groups.map((group) => (
                  <ToggleGroupItem key={group.id} value={group.id}>
                    {group.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </div>
        {action}
      </div>
      {cells || <div className='max-w-sm'>{control}</div>}
    </div>
  )
}

/** A split value's cells: a row per choice, a table for a pair, chips beyond */
function Cells({
  groups,
  hint,
  render,
}: {
  groups: MenuGroup[]
  /** Only where the cells cannot say it themselves */
  hint?: string
  render: (key: string) => React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-2'>
      <Grid groups={groups} render={render} />
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </div>
  )
}

function Grid({
  groups,
  render,
}: {
  groups: MenuGroup[]
  render: (key: string) => React.ReactNode
}) {
  if (groups.length === 1) {
    const [group] = groups
    return (
      <div className='grid gap-3 sm:grid-cols-2'>
        {group.options.map((o) => (
          <div key={o.id} className='flex items-center gap-3'>
            {/* Not truncate: with Label's leading-none its overflow-hidden
                cuts the tail off an Arabic letter */}
            <Label className='text-muted-foreground w-24 shrink-0 leading-normal font-normal'>
              {o.label}
            </Label>
            <div className='min-w-0 flex-1'>{render(optionSetKey([o.id]))}</div>
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 2) {
    const [rows, cols] = groups
    return (
      <div className='overflow-x-auto'>
        <Table>
          <TableHeader>
            <TableRow className='hover:bg-transparent'>
              <TableHead className='w-28'>{rows.label}</TableHead>
              {cols.options.map((c) => (
                <TableHead key={c.id} className='min-w-44'>
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.options.map((r) => (
              <TableRow key={r.id} className='hover:bg-transparent'>
                <TableCell className='text-muted-foreground font-medium'>
                  {r.label}
                </TableCell>
                {cols.options.map((c) => (
                  <TableCell key={c.id}>
                    {render(optionSetKey([r.id, c.id]))}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-2'>
      {combos(groups).map((combo) => {
        const ids = combo.map((o) => o.id)
        return (
          <div
            key={optionSetKey(ids)}
            className='flex flex-wrap items-center gap-2'
          >
            <div className='flex min-w-44 flex-wrap items-center gap-1'>
              {combo.map((o) => (
                <Badge key={o.id} variant='secondary' className='font-normal'>
                  {o.label}
                </Badge>
              ))}
            </div>
            <div className='min-w-48 flex-1'>{render(optionSetKey(ids))}</div>
          </div>
        )
      })}
    </div>
  )
}

function Quantity({
  value,
  unit,
  onChange,
}: {
  value: string
  unit: string
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <InputGroup>
      <InputGroupInput
        type='number'
        min='0'
        step='any'
        placeholder={t('quantity')}
        aria-label={t('quantity')}
        className='tabular-nums'
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && (
        <InputGroupAddon align='inline-end'>
          <InputGroupText>{unitLabel(unit, t)}</InputGroupText>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
