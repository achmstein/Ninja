import { CircleCheck, TriangleAlert } from 'lucide-react'
import { type StockCountView } from '@/api/inventory'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper } from '@/components/data-table'

type Translate = (key: TranslationKey, params?: TranslateParams) => string

type CountColumnsContext = {
  t: Translate
  locale: string
}

const columnHelper = createAppColumnHelper<StockCountView>()

/**
 * Stock counts, newest first. The verdict is what a manager scans for, so
 * it comes right after the date: how many lines were off, or a check when
 * everything matched.
 */
export function getCountColumns({ t, locale }: CountColumnsContext) {
  const dateTime = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return columnHelper.columns([
    columnHelper.accessor('countedAt', {
      meta: { align: 'end' },
      id: 'countedAt',
      header: t('countedAt'),
      cell: (info) => (
        <span className='tabular-nums'>
          {dateTime.format(new Date(info.getValue()))}
        </span>
      ),
    }),
    columnHelper.accessor((row) => toNumber(row.linesOff), {
      meta: { align: 'end' },
      id: 'verdict',
      header: t('result'),
      cell: ({ row }) => {
        const off = toNumber(row.original.linesOff)
        const total = toNumber(row.original.linesCounted)
        return (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-medium tabular-nums',
              off > 0 ? 'text-destructive' : 'text-success'
            )}
          >
            {off > 0 ? (
              <TriangleAlert className='h-4 w-4' />
            ) : (
              <CircleCheck className='h-4 w-4' />
            )}
            {off > 0
              ? t('countOffSummary', { off, total })
              : t('countAllMatched', { total })}
          </span>
        )
      },
    }),
    columnHelper.accessor('countedBy', {
      id: 'countedBy',
      header: t('countedBy'),
      cell: (info) => (
        <span className='text-muted-foreground'>{info.getValue() || '—'}</span>
      ),
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
