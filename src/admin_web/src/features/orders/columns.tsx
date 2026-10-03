import { Star, Trash2 } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  createAppColumnHelper,
  DataTableColumnHeader,
  type AppRow,
} from '@/components/data-table'
import { Dot, ListRow } from '@/components/list-row'
import { Money } from '@/components/money'
import { RowActions } from '@/components/row-actions'
import { StatusChip } from '@/components/status-chip'
import { When } from '@/components/when'
import { PlatformBadge } from './components/platform-badge'
import { getOrderStatus, isCancelled, orderSourceKeys } from './status'

const columnHelper = createAppColumnHelper<OrderSummary>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string
type Localize = (
  text: { en?: string | null; ar?: string | null } | null | undefined
) => string

type OrdersColumnsCallbacks = {
  onDelete: (orderNumber: number) => void
  isActing: boolean
  t: Translate
  localized: Localize
}

function OrderStatus({ status, t }: { status?: string | null; t: Translate }) {
  const known = getOrderStatus(status)
  if (!known) return <span>{status ?? '—'}</span>
  return (
    <StatusChip tone={known.variant} icon={known.icon}>
      {t(known.key)}
    </StatusChip>
  )
}

/** Where it came from: a delivery platform by its logo, else a quiet word */
function OrderSource({ order, t }: { order: OrderSummary; t: Translate }) {
  if (order.platform) return <PlatformBadge platform={order.platform} />
  const key = order.source ? orderSourceKeys[order.source] : null
  return key ? (
    <Badge variant='muted'>{t(key)}</Badge>
  ) : (
    <span className='text-muted-foreground'>—</span>
  )
}

function Rating({ value }: { value?: number | string | null }) {
  if (value == null) return null
  return (
    <span
      className='text-warning inline-flex items-center gap-0.5 text-xs font-medium tabular-nums'
      aria-label={`${value}/5`}
    >
      <Star className='size-3 fill-current' />
      {Number(value)}
    </span>
  )
}

/**
 * The history table, five things a row says: which order and when, who and
 * where, from where, its state (with the customer's stars when they gave
 * some), and the total. Confirm/cancel live in the details sheet the row
 * opens; a cancelled order can be deleted from its ⋯. Placed and Total sort
 * server-side.
 */
export function getOrdersColumns({
  onDelete,
  isActing,
  t,
  localized,
}: OrdersColumnsCallbacks) {
  return columnHelper.columns([
    // Only cancelled orders are deletable, so only they are selectable;
    // enableRowSelection on the table enforces it, the checkbox reflects it
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          onClick={(e) => e.stopPropagation()}
          aria-label={t('selectRow')}
        />
      ),
      meta: { className: 'w-[36px]' },
    }),
    columnHelper.accessor('date', {
      id: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('orderHash')} />
      ),
      cell: (info) => (
        <div className='flex flex-col leading-tight'>
          <span className='font-medium'>#{info.row.original.orderNumber}</span>
          <When
            value={info.getValue()}
            className='text-muted-foreground text-xs'
          />
        </div>
      ),
    }),
    columnHelper.accessor('userName', {
      id: 'customer',
      header: t('customer'),
      enableSorting: false,
      cell: (info) => {
        const place = localized(info.row.original.placeName)
        return (
          <div className='flex max-w-56 flex-col leading-tight'>
            <span className='truncate'>
              {info.getValue() || t('guestBadge')}
            </span>
            {place && (
              <span className='text-muted-foreground truncate text-xs'>
                {place}
              </span>
            )}
          </div>
        )
      },
    }),
    columnHelper.accessor('source', {
      id: 'source',
      header: t('source'),
      enableSorting: false,
      cell: (info) => <OrderSource order={info.row.original} t={t} />,
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: t('status'),
      enableSorting: false,
      cell: (info) => (
        <div className='flex items-center gap-2'>
          <OrderStatus status={info.getValue()} t={t} />
          <Rating value={info.row.original.ratingValue} />
        </div>
      ),
    }),
    columnHelper.accessor('total', {
      meta: { align: 'end' },
      id: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('total')}
          className='justify-end'
        />
      ),
      cell: (info) => <Money value={info.getValue()} strong />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RowActions
          actions={[
            {
              label: t('delete'),
              icon: Trash2,
              destructive: true,
              disabled: isActing,
              hidden: !isCancelled(row.original.status),
              onSelect: () => onDelete(Number(row.original.orderNumber)),
            },
          ]}
        />
      ),
      meta: { className: 'w-[48px]' },
    }),
  ])
}

/** An order as a phone lists it: number and who, then when, where and from where; the total over its state */
export function OrderListRow({
  row,
  t,
  localized,
}: {
  row: AppRow<OrderSummary>
  t: Translate
  localized: Localize
}) {
  const order = row.original
  const place = localized(order.placeName)
  return (
    <ListRow
      title={
        <>
          #{order.orderNumber}
          {order.userName && (
            <span className='text-muted-foreground font-normal'>
              {' '}
              · {order.userName}
            </span>
          )}
        </>
      }
      meta={
        <>
          <When value={order.date} />
          {place && (
            <>
              <Dot />
              <span className='truncate'>{place}</span>
            </>
          )}
          {order.platform && <PlatformBadge platform={order.platform} />}
          <Rating value={order.ratingValue} />
        </>
      }
      trailing={<Money value={order.total} strong />}
      trailingMeta={<OrderStatus status={order.status} t={t} />}
    />
  )
}
