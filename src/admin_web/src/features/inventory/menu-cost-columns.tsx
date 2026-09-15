import { Link } from '@tanstack/react-router'
import { CookingPot } from 'lucide-react'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createAppColumnHelper } from '@/components/data-table'
import { type MenuCostRow } from './menu-cost-rows'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

const columnHelper = createAppColumnHelper<MenuCostRow>()

/** Per tracked menu item: the price, what one sale costs, and what is left. */
export function getMenuCostColumns({
  t,
  localized,
  onEdit,
}: {
  t: Translate
  localized: Localized
  /** Opens the item's recipe for editing */
  onEdit: (catalogItemId: number) => void
}) {
  const endHeader = (key: TranslationKey) => () => (
    <div className='text-end'>{t(key)}</div>
  )
  const money = (value: number, className?: string) => (
    <div className={cn('text-end tabular-nums', className)}>
      {formatEgp(value)}
    </div>
  )

  return columnHelper.columns([
    columnHelper.accessor(
      (row) =>
        `${row.name?.en ?? ''} ${row.name?.ar ?? ''} ${row.category?.en ?? ''} ${row.category?.ar ?? ''}`,
      {
        id: 'item',
        header: t('menuItem'),
        cell: ({ row }) => (
          <div className='min-w-0'>
            <Link
              to='/menu'
              search={{ q: localized(row.original.name) }}
              className='font-medium underline-offset-4 hover:underline'
            >
              {localized(row.original.name) || '—'}
            </Link>
            <div className='text-muted-foreground truncate text-xs'>
              {localized(row.original.category)}
            </div>
          </div>
        ),
      }
    ),
    columnHelper.accessor('price', {
      id: 'price',
      header: endHeader('price'),
      cell: ({ row }) => money(row.original.price),
    }),
    columnHelper.accessor('cost', {
      id: 'cost',
      header: endHeader('costPerSaleHeader'),
      cell: ({ row }) => (
        <div className='text-end tabular-nums'>
          {formatEgp(row.original.cost)}
          {row.original.optionExtras > 0 && (
            <div className='text-muted-foreground text-xs'>
              {t('plusOptionExtras', { count: row.original.optionExtras })}
            </div>
          )}
          <Button
            type='button'
            variant='link'
            size='sm'
            className='h-auto p-0 text-xs'
            onClick={() => onEdit(row.original.catalogItemId)}
          >
            <CookingPot className='me-1 size-3' />
            {t('editRecipe')}
          </Button>
        </div>
      ),
    }),
    columnHelper.accessor('margin', {
      id: 'margin',
      header: endHeader('margin'),
      cell: ({ row }) =>
        money(
          row.original.margin,
          row.original.margin < 0 ? 'text-destructive' : undefined
        ),
    }),
    columnHelper.accessor((row) => row.foodCost ?? -1, {
      id: 'foodCost',
      header: endHeader('foodCostPercent'),
      cell: ({ row }) => {
        const { foodCost, status, uncosted, uncostedNames } = row.original
        return (
          <div className='flex items-center justify-end gap-2'>
            {status === 'incomplete' && (
              <Badge
                variant='outline'
                className='text-warning border-warning'
                title={uncostedNames.map(localized).join(' · ')}
              >
                {t('costIncomplete', { count: uncosted })}
              </Badge>
            )}
            {status === 'over' && (
              <Badge variant='destructive'>{t('overTarget')}</Badge>
            )}
            <span
              className={cn(
                'tabular-nums',
                status === 'over' && 'text-destructive font-medium'
              )}
            >
              {foodCost === null ? '—' : `${foodCost}%`}
            </span>
          </div>
        )
      },
    }),
  ])
}
