import { type RecipeView } from '@/api/inventory'
import { useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { formatQuantity } from '@/features/inventory/format'
import { fromApi, type SlotDraft } from '@/features/inventory/recipe-model'
import { type MenuGroup, type MenuOptions } from '../menu-options'
import { combos, reconstruct, type IngredientSpec } from '../recipe-cards'
import { Arrow, OptionChips, type StockInfo } from './recipe-editor'

/**
 * A saved recipe read the way it was written: one card per ingredient —
 * which item (or the table of bags by choice), how much (or per choice),
 * when — the same three lines the builder asks for. A slot the cards
 * cannot express is listed rule by rule.
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
  const label = (id: string | null) =>
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

function IngredientSummary({
  spec,
  menu,
  label,
  unit,
}: {
  spec: IngredientSpec
  menu: MenuOptions
  label: (id: string | null) => string
  unit: (id: string | null) => string
}) {
  const t = useT()
  const itemGroups = spec.item.groupIds
    .map((id) => menu.groups.find((g) => g.id === id))
    .filter((g): g is MenuGroup => !!g)
  const amountGroup = menu.groups.find((g) => g.id === spec.amount.groupId)
  const whenGroup = menu.groups.find((g) => g.id === spec.when.groupId)
  const baseId =
    spec.item.fixed ?? Object.values(spec.item.cells).find((v) => v) ?? null
  const u = unit(baseId)

  return (
    <div className='rounded-md border px-3 py-2'>
      {/* The item, and the table of bags when the choices decide it */}
      {itemGroups.length === 0 ? (
        <div className='font-medium'>{label(spec.item.fixed)}</div>
      ) : (
        <>
          <div className='text-muted-foreground text-xs'>
            {t('dependsOn', {
              groups: itemGroups.map((g) => g.label).join(' × '),
            })}
          </div>
          {itemGroups.length === 1 ? (
            <ul className='mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2'>
              {itemGroups[0].options.map((o) => (
                <li key={o.id} className='flex gap-1.5'>
                  <span className='text-muted-foreground min-w-16'>
                    {o.label}
                  </span>
                  <span>{label(spec.item.cells[o.id] ?? null)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <table className='mt-1 text-xs'>
              <thead>
                <tr>
                  <th />
                  {itemGroups[1].options.map((c) => (
                    <th key={c.id} className='pe-3 text-start font-medium'>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {itemGroups[0].options.map((r) => (
                  <tr key={r.id}>
                    <td className='text-muted-foreground pe-3 font-medium'>
                      {r.label}
                    </td>
                    {itemGroups[1].options.map((c) => {
                      const key = combos([itemGroups[0], itemGroups[1]])
                        .map((combo) => combo.map((o) => o.id))
                        .find(
                          (ids) => ids.includes(r.id) && ids.includes(c.id)
                        )!
                      return (
                        <td key={c.id} className='pe-3'>
                          {label(
                            spec.item.cells[
                              [...key]
                                .sort((a, b) => Number(a) - Number(b))
                                .join('+')
                            ] ?? null
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* The amount: one row per choice when a group decides it, laid out like the item table */}
      {amountGroup ? (
        <>
          <div className='text-muted-foreground mt-1 text-xs'>
            {t('dependsOn', { groups: amountGroup.label })}
          </div>
          <ul className='mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2'>
            {amountGroup.options.map((o) => (
              <li key={o.id} className='flex gap-1.5'>
                <span className='text-muted-foreground min-w-16'>
                  {o.label}
                </span>
                <span className='tabular-nums'>
                  {toNumber(spec.amount.values[o.id]) > 0
                    ? formatQuantity(spec.amount.values[o.id], u, t)
                    : t('nothing')}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className='mt-1 text-xs tabular-nums'>
          {formatQuantity(spec.amount.fixed, u, t)}
        </div>
      )}
      {whenGroup && (
        <div className='text-muted-foreground mt-1 text-xs'>
          {t('onlyWith', { group: whenGroup.label })}:{' '}
          {whenGroup.options
            .filter((o) => spec.when.only.includes(o.id))
            .map((o) => o.label)
            .join('، ')}
        </div>
      )}
    </div>
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
  label: (id: string | null) => string
  unit: (id: string | null) => string
}) {
  const t = useT()
  return (
    <div className='rounded-md border border-dashed px-3 py-2'>
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
