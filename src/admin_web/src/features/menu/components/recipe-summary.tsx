import { type RecipeView } from '@/api/inventory'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { formatQuantity } from '@/features/inventory/format'
import {
  fromApi,
  optionSetKey,
  type SlotDraft,
} from '@/features/inventory/recipe-model'
import { type MenuGroup, type MenuOptions } from '../menu-options'
import {
  combos,
  ONE,
  reconstruct,
  type IngredientSpec,
  type Varying,
} from '../recipe-cards'
import { Arrow, OptionChips, type StockInfo } from './recipe-editor'

/**
 * A saved recipe read the way it was written: one card per ingredient —
 * which item and how much, each either one value or one per combination
 * of the choices it was split by. A slot the cards cannot express is
 * listed rule by rule.
 */
export function RecipeSummary({
  recipe,
  menu,
  stock,
}: {
  recipe: RecipeView
  menu: MenuOptions
  stock: Map<string, StockInfo>
}) {
  const t = useT()
  const draft = fromApi(
    recipe,
    (optionId) => {
      const option = menu.byId.get(optionId)
      return option ? menu.groups[option.groupIndex]?.id : undefined
    },
    menu.groups.map((g) => g.id)
  )
  const { ingredients, custom } = reconstruct(draft, menu)
  const label = (id: string | null | undefined) =>
    (id && stock.get(id)?.label) || t('pickStockItem')
  const unit = (id: string | null) => (id && stock.get(id)?.unit) || ''

  return (
    <div className='space-y-2 text-sm'>
      {ingredients.map((spec) => (
        <IngredientSummary
          key={spec.key}
          spec={spec}
          menu={menu}
          label={label}
          unit={unit}
        />
      ))}
      {custom.map((slot) => (
        <CustomSlot
          key={slot.key}
          slot={slot}
          menu={menu}
          label={label}
          unit={unit}
        />
      ))}
    </div>
  )
}

/** The groups a value is split by, as the menu has them */
const groupsOf = (varying: Varying<unknown>, menu: MenuOptions): MenuGroup[] =>
  varying.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => !!g)

function IngredientSummary({
  spec,
  menu,
  label,
  unit,
}: {
  spec: IngredientSpec
  menu: MenuOptions
  label: (id: string | null | undefined) => string
  unit: (id: string | null) => string
}) {
  const t = useT()
  const itemGroups = groupsOf(spec.item, menu)
  const amountGroups = groupsOf(spec.amount, menu)
  const baseId = Object.values(spec.item.cells).find((v) => v) ?? null
  const u = unit(baseId)

  return (
    <div className='rounded-lg border px-3 py-2'>
      {/* The item, and the cells when the choices decide it */}
      {itemGroups.length === 0 ? (
        <div className='font-medium'>{label(spec.item.cells[ONE])}</div>
      ) : (
        <>
          <div className='text-muted-foreground text-xs'>
            {t('dependsOn', {
              groups: itemGroups.map((g) => g.label).join(' × '),
            })}
          </div>
          <Cells
            varying={spec.item}
            groups={itemGroups}
            menu={menu}
            render={(value) => label(value)}
          />
        </>
      )}

      {/* The amount, laid out the same way; nothing is how a choice drops it */}
      {amountGroups.length === 0 ? (
        <div className='mt-1 text-xs tabular-nums'>
          {formatQuantity(spec.amount.cells[ONE] ?? '', u, t)}
        </div>
      ) : (
        <>
          <div className='text-muted-foreground mt-1 text-xs'>
            {t('dependsOn', {
              groups: amountGroups.map((g) => g.label).join(' × '),
            })}
          </div>
          <Cells
            varying={spec.amount}
            groups={amountGroups}
            menu={menu}
            numeric
            render={(value) =>
              toNumber(value ?? '') > 0
                ? formatQuantity(value ?? '', u, t)
                : t('nothing')
            }
          />
        </>
      )}
    </div>
  )
}

/** A split value's cells: a list for one group, a table for two, chips beyond */
function Cells<T>({
  varying,
  groups,
  menu,
  render,
  numeric,
}: {
  varying: Varying<T>
  groups: MenuGroup[]
  menu: MenuOptions
  render: (value: T | undefined) => string
  numeric?: boolean
}) {
  const at = (ids: string[]) => varying.cells[optionSetKey(ids)]
  const value = numeric ? 'tabular-nums' : undefined

  if (groups.length === 1) {
    return (
      <ul className='mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2'>
        {groups[0].options.map((o) => (
          <li key={o.id} className='flex gap-1.5'>
            <span className='text-muted-foreground min-w-16'>{o.label}</span>
            <span className={value}>{render(at([o.id]))}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (groups.length === 2) {
    const [rows, cols] = groups
    return (
      <table className='mt-1 text-xs'>
        <thead>
          <tr>
            <th />
            {cols.options.map((c) => (
              <th key={c.id} className='pe-3 text-start font-medium'>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.options.map((r) => (
            <tr key={r.id}>
              <td className='text-muted-foreground pe-3 font-medium'>
                {r.label}
              </td>
              {cols.options.map((c) => (
                <td key={c.id} className={cn('pe-3', value)}>
                  {render(at([r.id, c.id]))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <ul className='mt-1 space-y-0.5 text-xs'>
      {combos(groups).map((combo) => {
        const ids = combo.map((o) => o.id)
        return (
          <li
            key={optionSetKey(ids)}
            className='flex flex-wrap items-center gap-x-1.5'
          >
            <OptionChips optionIds={ids} menu={menu} />
            <Arrow className='text-muted-foreground' />
            <span className={value}>{render(at(ids))}</span>
          </li>
        )
      })}
    </ul>
  )
}

function CustomSlot({
  slot,
  menu,
  label,
  unit,
}: {
  slot: SlotDraft
  menu: MenuOptions
  label: (id: string | null | undefined) => string
  unit: (id: string | null) => string
}) {
  const t = useT()
  return (
    <div className='rounded-lg border border-dashed px-3 py-2'>
      {slot.hasDefault && (
        <div>
          <span className='text-muted-foreground tabular-nums'>
            {formatQuantity(slot.quantity, unit(slot.stockItemId), t)}
          </span>{' '}
          <span className='font-medium'>{label(slot.stockItemId)}</span>
        </div>
      )}
      <ul className='mt-1 space-y-0.5 text-xs'>
        {slot.overrides.map((o) => (
          <li key={o.key} className='flex flex-wrap items-center gap-x-1.5'>
            <OptionChips optionIds={o.optionIds} menu={menu} />
            <Arrow className='text-muted-foreground' />
            {o.none ? (
              <span className='text-muted-foreground'>{t('nothing')}</span>
            ) : (
              <span>
                <span className='text-muted-foreground tabular-nums'>
                  {formatQuantity(
                    o.quantity || slot.quantity,
                    unit(o.stockItemId ?? slot.stockItemId),
                    t
                  )}
                </span>{' '}
                {label(o.stockItemId ?? slot.stockItemId)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
