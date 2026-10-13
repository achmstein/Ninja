import { Link } from '@tanstack/react-router'
import { type ItemAdvice } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper } from '@/components/data-table'
import { StatusChip } from '@/components/status-chip'
import {
  ADVICE_LABEL,
  CLASS_LABEL,
  CLASS_TONE,
} from './menu-engineering-labels'
import { type MenuEngineeringRow } from './menu-engineering-rows'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

/** Where an item stands, or why it could not be placed */
export function ClassChip({
  row,
  t,
}: {
  row: MenuEngineeringRow
  t: Translate
}) {
  return row.menuClass ? (
    <StatusChip tone={CLASS_TONE[row.menuClass]}>
      {t(CLASS_LABEL[row.menuClass])}
    </StatusChip>
  ) : (
    <StatusChip tone='muted' dot={false}>
      {t(row.status === 'incomplete' ? 'costIncomplete' : 'notPlaced', {
        count: row.uncosted,
      })}
    </StatusChip>
  )
}

/** Per item: its class, what it sold, what each sale and all of them left, and Ninja's word on it. */
export function getMenuEngineeringColumns({
  t,
  localized,
  advice,
}: {
  t: Translate
  localized: Localized
  advice: Map<number, ItemAdvice>
}) {
  const endHeader = (key: TranslationKey) => () => (
    <div className='text-end'>{t(key)}</div>
  )

  const columnHelper = createAppColumnHelper<MenuEngineeringRow>()
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
    columnHelper.display({
      id: 'class',
      header: t('menuClass'),
      cell: ({ row }) => <ClassChip row={row.original} t={t} />,
    }),
    columnHelper.accessor('sold', {
      meta: { align: 'end' },
      id: 'sold',
      header: endHeader('unitsSold'),
      cell: ({ row }) => (
        <div className='text-end tabular-nums'>
          {row.original.sold.toLocaleString()}
          {row.original.menuClass && (
            <div className='text-muted-foreground text-xs'>
              {t('mixShare', {
                share: (row.original.mix * 100).toFixed(1),
              })}
            </div>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('margin', {
      meta: { align: 'end' },
      id: 'margin',
      header: endHeader('margin'),
      cell: ({ row }) => (
        <div
          className={cn(
            'text-end tabular-nums',
            row.original.margin < 0 && 'text-destructive'
          )}
        >
          {formatEgp(row.original.margin)}
          <div className='text-muted-foreground text-xs'>
            {t('price')} {formatEgp(row.original.price)}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor('contribution', {
      meta: { align: 'end' },
      id: 'contribution',
      header: endHeader('contribution'),
      cell: ({ row }) => (
        <div className='text-end font-medium tabular-nums'>
          {formatEgp(row.original.contribution)}
        </div>
      ),
    }),
    columnHelper.display({
      id: 'advice',
      header: t('ninjaAdvice'),
      cell: ({ row }) => {
        const said = advice.get(row.original.catalogItemId)
        if (!said) return null
        return (
          <div className='max-w-72 min-w-48 text-sm'>
            <div className='text-primary font-medium'>
              {ADVICE_LABEL[said.action] ? t(ADVICE_LABEL[said.action]) : ''}
            </div>
            <div className='text-muted-foreground text-xs'>
              {localized(said.advice)}
            </div>
          </div>
        )
      },
    }),
  ])
}
