import { type MovementView } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper } from '@/components/data-table'
import { When } from '@/components/when'
import { MovementTypeBadge } from './components/movement-type-badge'
import { formatSignedQuantity, referenceLabel } from './format'

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
 * The stock ledger, read under day headings: the time, what moved and
 * why. Six columns; the reference and reason share one cell so the eye
 * lands on item and quantity.
 */
export function getMovementColumns({ t, localized }: MovementColumnsContext) {
  return columnHelper.columns([
    columnHelper.accessor('recordedAt', {
      id: 'recordedAt',
      header: t('time'),
      cell: (info) => (
        <When
          value={info.getValue()}
          mode='time'
          className='text-muted-foreground'
        />
      ),
      meta: { className: 'w-[88px]' },
    }),
    columnHelper.accessor((row) => localized(row.stockItemName), {
      id: 'item',
      header: t('stockItem'),
      cell: (info) => <span className='font-medium'>{info.getValue()}</span>,
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
        [row.reason, referenceLabel(row.reference, t)]
          .filter(Boolean)
          .join(' '),
      {
        id: 'details',
        header: t('details'),
        cell: ({ row }) => {
          const { reason, reference } = row.original
          return (
            <span className='text-muted-foreground'>
              {reason || referenceLabel(reference, t)}
            </span>
          )
        },
      }
    ),
  ])
}
