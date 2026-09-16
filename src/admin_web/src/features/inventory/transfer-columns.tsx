import { ArrowRight } from 'lucide-react'
import { type TransferView } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { createAppColumnHelper } from '@/components/data-table'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

type TransferColumnsContext = {
  t: Translate
  locale: string
  /** Display name for a branch id, from the public branch list */
  branchName: (id: number | string) => string
}

const columnHelper = createAppColumnHelper<TransferView>()

/** Transfers, newest first: when, which way, how many lines, who sent them. */
export function getTransferColumns({
  t,
  locale,
  branchName,
}: TransferColumnsContext) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return columnHelper.columns([
    columnHelper.accessor('sentAt', {
      meta: { align: 'end' },
      id: 'sentAt',
      header: t('sentAt'),
      cell: (info) => (
        <span className='tabular-nums'>
          {dateTime.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.display({
      id: 'route',
      header: t('fromTo'),
      cell: ({ row }) => (
        <span className='flex items-center gap-1.5 font-medium'>
          {branchName(row.original.fromBranchId)}
          <ArrowRight className='text-muted-foreground h-3.5 w-3.5 shrink-0 rtl:rotate-180' />
          {branchName(row.original.toBranchId)}
        </span>
      ),
    }),
    columnHelper.accessor((row) => row.lines.length, {
      meta: { align: 'end' },
      id: 'lines',
      header: () => <div className='text-end'>{t('lines')}</div>,
      cell: (info) => (
        <div className='text-end tabular-nums'>{info.getValue()}</div>
      ),
    }),
    columnHelper.accessor('sentBy', {
      id: 'sentBy',
      header: t('sentBy'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('note', {
      id: 'note',
      header: t('note'),
      cell: (info) => (
        <span className='text-muted-foreground'>{info.getValue() || '—'}</span>
      ),
    }),
  ])
}
