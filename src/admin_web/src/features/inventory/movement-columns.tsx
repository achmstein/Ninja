import { type MovementView } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper } from '@/components/data-table'
import { MovementTypeBadge } from './components/movement-type-badge'
import { formatSignedQuantity, actorLabel, referenceLabel } from './format'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

type MovementColumnsContext = {
  t: Translate
  localized: Localized
  locale: string
}

const columnHelper = createAppColumnHelper<MovementView>()

/**
 * The stock ledger, read under day headings: the time, what moved, why,
 * and who posted it. Six columns; the reference, reason and actor share
 * one cell so the eye lands on item and quantity.
 */
export function getMovementColumns({
  t,
  localized,
  locale,
}: MovementColumnsContext) {
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' })

  return columnHelper.columns([
    columnHelper.accessor('recordedAt', {
      id: 'recordedAt',
      header: t('time'),
      cell: (info) => (
        <span className='text-muted-foreground tabular-nums'>
          {time.format(new Date(info.getValue()))}
        </span>
      ),
      meta: { className: 'w-[88px]' },
    }),
    columnHelper.accessor((row) => localized(row.stockItemName), {
      id: 'item',
      header: t('stockItem'),
      cell: (info) => (
        <span className='font-medium'>{info.getValue() || '—'}</span>
      ),
    }),
    columnHelper.accessor('type', {
      id: 'type',
      header: t('type'),
      cell: (info) => <MovementTypeBadge type={info.getValue()} />,
    }),
    columnHelper.accessor((row) => toNumber(row.quantity), {
      meta: { align: 'end' },
      id: 'quantity',
      header: () => <div className='text-end'>{t('quantity')}</div>,
      cell: ({ row }) => {
        const quantity = toNumber(row.original.quantity)
        return (
          <div
            className={cn(
              'text-end font-medium tabular-nums',
              quantity < 0 && 'text-destructive',
              quantity > 0 && 'text-success'
            )}
          >
            {formatSignedQuantity(quantity, row.original.unit, t)}
          </div>
        )
      },
    }),
    columnHelper.accessor('unitCost', {
      meta: { align: 'end' },
      id: 'unitCost',
      header: () => <div className='text-end'>{t('unitCost')}</div>,
      cell: (info) => (
        <div className='text-muted-foreground text-end tabular-nums'>
          {formatEgp(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor(
      (row) =>
        [
          row.reason,
          referenceLabel(row.reference, t),
          actorLabel(row.recordedBy, t),
        ]
          .filter(Boolean)
          .join(' '),
      {
        id: 'details',
        header: t('details'),
        cell: ({ row }) => {
          const { reason, reference, recordedBy } = row.original
          const what = reason || referenceLabel(reference, t)
          const who = actorLabel(recordedBy, t)
          return (
            <span className='text-muted-foreground'>
              {what || '—'}
              {who && <span className='text-xs'> · {who}</span>}
            </span>
          )
        },
      }
    ),
  ])
}
