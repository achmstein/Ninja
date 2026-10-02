import { type TicketHistoryRow, type TicketSummary } from '@/api/sales'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { formatEgp, toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'
import { createAppColumnHelper, type AppRow } from '@/components/data-table'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { urgencyFor, urgencyTextClass } from '@/components/queue-card'
import { When } from '@/components/when'
import { relativeTime } from '@/features/orders/status'
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

// An open tab nobody has touched for a while is the one to look at
const IDLE_WARN_MINUTES = 30
const IDLE_DELAYED_MINUTES = 60

const historyHelper = createAppColumnHelper<TicketHistoryRow>()
const openHelper = createAppColumnHelper<TicketSummary>()

/** The total, and what was refunded off it on a quiet red line under it */
function BillTotal({
  total,
  refunded,
  t,
}: {
  total: number | string | null | undefined
  refunded: number | string | null | undefined
  t: Translate
}) {
  const back = toNumber(refunded)
  return (
    <Money
      value={total}
      strong
      sub={
        back > 0 ? (
          <span className='text-destructive'>
            {t('refunded')} −{formatEgp(back)}
          </span>
        ) : undefined
      }
    />
  )
}

/**
 * Settled or voided bills, grouped by day so a row needs only its time:
 * the receipt and when, where and what kind, who closed it, and the bill
 * with any refund under it.
 */
export function getHistoryColumns({
  t,
  localized,
  voided,
}: ColumnsContext & { voided: boolean }) {
  return historyHelper.columns([
    historyHelper.accessor('receiptNumber', {
      id: 'receipt',
      header: t('receiptHash'),
      cell: (info) => {
        const value = info.getValue()
        return (
          <div className='flex flex-col leading-tight'>
            <span className='font-medium tabular-nums'>
              {value != null ? `#${toNumber(value)}` : '—'}
            </span>
            <When
              value={info.row.original.closedAt}
              mode='time'
              className='text-muted-foreground text-xs'
            />
          </div>
        )
      },
    }),
    historyHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => (
        <div className='flex items-center gap-2'>
          <span className='max-w-56 truncate'>{info.getValue() || '—'}</span>
          <TypeBadge type={info.row.original.type} />
        </div>
      ),
    }),
    historyHelper.accessor('closedBy', {
      id: 'closedBy',
      header: t(voided ? 'voidedBy' : 'settledBy'),
      meta: { emphasis: 'muted' },
      cell: (info) => info.getValue() || '—',
    }),
    historyHelper.accessor('total', {
      id: 'total',
      meta: { align: 'end' },
      header: t('total'),
      cell: (info) => (
        <BillTotal
          total={info.getValue()}
          refunded={info.row.original.refundedTotal}
          t={t}
        />
      ),
    }),
  ])
}

/** A closed bill as a phone lists it, under its day's heading */
export function HistoryListRow({
  row,
  t,
  localized,
}: {
  row: AppRow<TicketHistoryRow>
  t: Translate
  localized: Localized
}) {
  const bill = row.original
  return (
    <ListRow
      title={ticketTitle(bill, localized, t) || '—'}
      meta={
        <>
          {bill.receiptNumber != null && (
            <span className='tabular-nums'>
              #{toNumber(bill.receiptNumber)}
            </span>
          )}
          <Dot />
          <When value={bill.closedAt} mode='time' />
          {bill.closedBy && (
            <>
              <Dot />
              <span className='truncate'>{bill.closedBy}</span>
            </>
          )}
        </>
      }
      trailing={
        <BillTotal total={bill.total} refunded={bill.refundedTotal} t={t} />
      }
    />
  )
}

function Idle({
  value,
  nowMs,
  t,
  locale,
}: {
  value: string | null | undefined
  nowMs: number
  t: Translate
  locale: string
}) {
  const urgency = urgencyFor(
    value ?? undefined,
    nowMs,
    IDLE_WARN_MINUTES,
    IDLE_DELAYED_MINUTES
  )
  return (
    <span className={cn('tabular-nums', urgencyTextClass(urgency))}>
      {relativeTime(value ?? undefined, nowMs, t, locale) || '—'}
    </span>
  )
}

/**
 * Bills still on the floor: which and where, when it opened, how long since
 * anyone touched it (amber, then red, as it goes quiet), and how much so far.
 */
export function getOpenColumns({
  t,
  localized,
  locale,
  nowMs,
}: ColumnsContext & { nowMs: number }) {
  return openHelper.columns([
    openHelper.accessor((row) => ticketTitle(row, localized, t), {
      id: 'place',
      header: t('place'),
      cell: (info) => {
        const customers = info.row.original.customerIds?.length ?? 0
        return (
          <div className='flex flex-col leading-tight'>
            <div className='flex items-center gap-2'>
              <span className='max-w-56 truncate font-medium'>
                {info.getValue() || `#${toNumber(info.row.original.id)}`}
              </span>
              <TypeBadge type={info.row.original.type} />
            </div>
            {customers > 0 && (
              <span className='text-muted-foreground text-xs'>
                {t('customersCount', { count: customers })}
              </span>
            )}
          </div>
        )
      },
    }),
    openHelper.accessor('openedAt', {
      id: 'openedAt',
      header: t('openedAt'),
      meta: { emphasis: 'muted' },
      cell: (info) => <When value={info.getValue()} mode='time' />,
    }),
    openHelper.accessor('lastActivityAt', {
      id: 'lastActivity',
      header: t('lastActivity'),
      cell: (info) => (
        <Idle value={info.getValue()} nowMs={nowMs} t={t} locale={locale} />
      ),
    }),
    openHelper.accessor('total', {
      id: 'total',
      meta: { align: 'end' },
      header: t('total'),
      cell: (info) => (
        <Money
          value={info.getValue()}
          strong
          sub={`${toNumber(info.row.original.lineCount)} ${t('lines')}`}
        />
      ),
    }),
  ])
}

/** An open bill as a phone lists it: where, how long quiet, how much so far */
export function OpenListRow({
  row,
  t,
  localized,
  locale,
  nowMs,
}: {
  row: AppRow<TicketSummary>
  t: Translate
  localized: Localized
  locale: string
  nowMs: number
}) {
  const bill = row.original
  return (
    <ListRow
      title={ticketTitle(bill, localized, t) || `#${toNumber(bill.id)}`}
      meta={
        <>
          <TypeBadge type={bill.type} />
          <Idle
            value={bill.lastActivityAt}
            nowMs={nowMs}
            t={t}
            locale={locale}
          />
        </>
      }
      trailing={<Money value={bill.total} strong />}
    />
  )
}
