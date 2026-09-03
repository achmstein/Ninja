import { type TicketHistoryRow, type TicketSummary } from '@/api/sales'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { createAppColumnHelper } from '@/components/data-table'
import { ticketTitle } from './components/ticket-title'
import { TypeBadge } from './components/ticket-type'

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localized = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

type ColumnsContext = {
  t: Translate
  localized: Localized
  locale: string
}

const historyHelper = createAppColumnHelper<TicketHistoryRow>()
const openHelper = createAppColumnHelper<TicketSummary>()

function formatAt(value: string | null | undefined, locale: string) {
  if (!value) return '—'
  return (
    <span className='tabular-nums'>
      {new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))}
    </span>
  )
}

function money(value: number | string | null | undefined) {
  return (
    <div className='text-end font-medium tabular-nums'>{formatEgp(value)}</div>
  )
}

/** Settled or voided tickets: the receipt, when and who closed it, the bill. */
export function getHistoryColumns({
  t,
  localized,
  locale,
  voided,
}: ColumnsContext & { voided: boolean }) {
  return historyHelper.columns([
    historyHelper.accessor('receiptNumber', {
      id: 'receipt',
      header: t('receiptHash'),
      cell: (info) => {
        const value = info.getValue()
        return value != null ? (
          <span className='font-medium tabular-nums'>#{toNumber(value)}</span>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
      },
    }),
    historyHelper.accessor('closedAt', {
      id: 'closedAt',
      header: t(voided ? 'voidedAt' : 'settledAtLabel'),
      cell: (info) => formatAt(info.getValue(), locale),
    }),
    historyHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => info.getValue() || '—',
    }),
    historyHelper.accessor('type', {
      id: 'type',
      header: t('type'),
      cell: (info) => <TypeBadge type={info.getValue()} />,
    }),
    historyHelper.accessor('closedBy', {
      id: 'closedBy',
      header: t(voided ? 'voidedBy' : 'settledBy'),
      cell: (info) => info.getValue() || '—',
    }),
    historyHelper.accessor('refundedTotal', {
      id: 'refunded',
      header: () => <div className='text-end'>{t('refunded')}</div>,
      cell: (info) => {
        const value = toNumber(info.getValue())
        return value > 0 ? (
          <div className='text-destructive text-end tabular-nums'>
            −{formatEgp(value)}
          </div>
        ) : null
      },
    }),
    historyHelper.accessor('total', {
      id: 'total',
      header: () => <div className='text-end'>{t('total')}</div>,
      cell: (info) => money(info.getValue()),
    }),
  ])
}

/** Tickets still on the floor: what is open, since when, and for how much. */
export function getOpenColumns({ t, localized, locale }: ColumnsContext) {
  return openHelper.columns([
    openHelper.accessor('id', {
      id: 'id',
      header: t('ticketHash'),
      cell: (info) => (
        <span className='font-medium tabular-nums'>
          #{toNumber(info.getValue())}
        </span>
      ),
    }),
    openHelper.accessor('openedAt', {
      id: 'openedAt',
      header: t('openedAt'),
      cell: (info) => formatAt(info.getValue(), locale),
    }),
    openHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => info.getValue() || '—',
    }),
    openHelper.accessor('type', {
      id: 'type',
      header: t('type'),
      cell: (info) => <TypeBadge type={info.getValue()} />,
    }),
    openHelper.accessor('lastActivityAt', {
      id: 'lastActivity',
      header: t('lastActivity'),
      cell: (info) => formatAt(info.getValue(), locale),
    }),
    openHelper.accessor('lineCount', {
      id: 'lines',
      header: () => <div className='text-end'>{t('lines')}</div>,
      cell: (info) => (
        <div className='text-end tabular-nums'>{toNumber(info.getValue())}</div>
      ),
    }),
    openHelper.accessor('total', {
      id: 'total',
      header: () => <div className='text-end'>{t('total')}</div>,
      cell: (info) => money(info.getValue()),
    }),
  ])
}
