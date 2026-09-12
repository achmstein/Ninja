import { type UsageReportRow } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper } from '@/components/data-table'
import { formatQuantity, formatSignedQuantity, unitLabel } from './format'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

type ReportColumnsContext = {
  t: Translate
  localized: Localized
}

const columnHelper = createAppColumnHelper<UsageReportRow>()

// A quantity over its value, right-aligned; a dash when nothing moved. A plain
// render helper, not a component, so the file stays a non-component module.
function quantityValue(
  t: Translate,
  quantity: number | string,
  value: number | string,
  unit: string,
  signed = false
) {
  const n = toNumber(quantity)
  if (n === 0 && toNumber(value) === 0) {
    return <div className='text-muted-foreground text-end'>—</div>
  }
  return (
    <div
      className={cn(
        'text-end tabular-nums',
        signed && n < 0 && 'text-destructive'
      )}
    >
      <div>
        {signed ? formatSignedQuantity(n, unit, t) : formatQuantity(n, unit, t)}
      </div>
      <div
        className={cn(
          'text-xs',
          signed && n < 0 ? 'text-destructive/80' : 'text-muted-foreground'
        )}
      >
        {formatEgp(value)}
      </div>
    </div>
  )
}

/** Per item over the period: what came in, what went out, and the gaps the counts found. */
export function getReportColumns({ t, localized }: ReportColumnsContext) {
  const endHeader = (key: TranslationKey) => () => (
    <div className='text-end'>{t(key)}</div>
  )

  return columnHelper.columns([
    columnHelper.accessor(
      (row) => `${row.name?.en ?? ''} ${row.name?.ar ?? ''}`,
      {
        id: 'item',
        header: t('stockItem'),
        cell: ({ row }) => (
          <span className='font-medium'>
            {localized(row.original.name) || '—'}
          </span>
        ),
      }
    ),
    columnHelper.accessor('unit', {
      id: 'unit',
      header: t('unit'),
      cell: (info) => (
        <span className='text-muted-foreground'>
          {unitLabel(info.getValue(), t)}
        </span>
      ),
    }),
    columnHelper.accessor((row) => toNumber(row.purchased), {
      id: 'purchased',
      header: endHeader('purchased'),
      cell: ({ row }) =>
        quantityValue(
          t,
          row.original.purchased,
          row.original.purchasedValue,
          row.original.unit
        ),
    }),
    columnHelper.accessor((row) => toNumber(row.sold), {
      id: 'sold',
      header: endHeader('sold'),
      cell: ({ row }) =>
        quantityValue(
          t,
          row.original.sold,
          row.original.soldValue,
          row.original.unit
        ),
    }),
    columnHelper.accessor((row) => toNumber(row.wasted), {
      id: 'wasted',
      header: endHeader('waste'),
      cell: ({ row }) =>
        quantityValue(
          t,
          row.original.wasted,
          row.original.wastedValue,
          row.original.unit
        ),
    }),
    columnHelper.accessor((row) => toNumber(row.countVariance), {
      id: 'countVariance',
      header: endHeader('countVariance'),
      cell: ({ row }) =>
        quantityValue(
          t,
          row.original.countVariance,
          row.original.countVarianceValue,
          row.original.unit,
          true
        ),
    }),
    columnHelper.accessor(
      (row) => toNumber(row.transferredIn) + toNumber(row.transferredOut),
      {
        id: 'transfers',
        header: () => (
          <div className='text-end'>
            <div>{t('inventoryTransfers')}</div>
            <div className='text-muted-foreground text-xs font-normal'>
              {t('inOut')}
            </div>
          </div>
        ),
        cell: ({ row }) => {
          const { transferredIn, transferredOut, unit } = row.original
          const inQty = toNumber(transferredIn)
          const outQty = toNumber(transferredOut)
          if (inQty === 0 && outQty === 0) {
            return <div className='text-muted-foreground text-end'>—</div>
          }
          return (
            <div className='text-end text-sm tabular-nums'>
              <div className={cn(inQty === 0 && 'text-muted-foreground')}>
                {formatSignedQuantity(inQty, unit, t)}
              </div>
              <div className={cn(outQty === 0 && 'text-muted-foreground')}>
                {formatSignedQuantity(-outQty, unit, t)}
              </div>
            </div>
          )
        },
      }
    ),
  ])
}
