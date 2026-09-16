import { type PurchaseView } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp } from '@/lib/money'
import { createAppColumnHelper } from '@/components/data-table'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

type PurchaseColumnsContext = {
  t: Translate
  locale: string
}

const columnHelper = createAppColumnHelper<PurchaseView>()

/** Deliveries, newest first: when, from whom, how many lines, the bill. */
export function getPurchaseColumns({ t, locale }: PurchaseColumnsContext) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return columnHelper.columns([
    columnHelper.accessor('receivedAt', {
      meta: { align: 'end' },
      id: 'receivedAt',
      header: t('receivedAt'),
      cell: (info) => (
        <span className='tabular-nums'>
          {dateTime.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.accessor('supplier', {
      id: 'supplier',
      header: t('supplier'),
      cell: (info) => (
        <span className='font-medium'>
          {info.getValue() || <span className='text-muted-foreground'>—</span>}
        </span>
      ),
    }),
    columnHelper.accessor('invoiceRef', {
      id: 'invoiceRef',
      header: t('invoiceRef'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor((row) => row.lines.length, {
      meta: { align: 'end' },
      id: 'lines',
      header: () => <div className='text-end'>{t('lines')}</div>,
      cell: (info) => (
        <div className='text-end tabular-nums'>{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('total', {
      meta: { align: 'end' },
      id: 'total',
      header: () => <div className='text-end'>{t('total')}</div>,
      cell: (info) => (
        <div className='text-end font-medium tabular-nums'>
          {formatEgp(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor('receivedBy', {
      id: 'receivedBy',
      header: t('receivedBy'),
      cell: (info) => info.getValue() || '—',
    }),
  ])
}
