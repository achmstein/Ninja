import { Eye, Trash2 } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { type TranslateParams, type TranslationKey } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  createAppColumnHelper,
  DataTableColumnHeader,
} from '@/components/data-table'
import {
  formatEgp,
  getOrderStatus,
  isCancelled,
  orderSourceKeys,
} from './status'

const columnHelper = createAppColumnHelper<OrderSummary>()

type Translate = (key: TranslationKey, params?: TranslateParams) => string

function formatRelative(date: Date, t: Translate, locale: string): string {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { minutes })
  const hours = Math.round(minutes / 60)
  if (hours < 24) return t('hoursAgo', { hours })
  const days = Math.round(hours / 24)
  if (days < 7) return t('daysAgo', { days })
  return date.toLocaleDateString(locale)
}

type OrdersColumnsCallbacks = {
  onView: (orderNumber: number) => void
  onDelete: (orderNumber: number) => void
  isActing: boolean
  t: Translate
  localized: (
    text: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
  locale: string
}

/**
 * The history table. Confirm/cancel live in the details sheet (one place to
 * act, with the line items in view); the row only opens it or deletes a
 * cancelled order. Placed and Total sort server-side.
 */
export function getOrdersColumns({
  onView,
  onDelete,
  isActing,
  t,
  localized,
  locale,
}: OrdersColumnsCallbacks) {
  return columnHelper.columns([
    // Only cancelled orders are deletable, so only they are selectable —
    // enableRowSelection on the table enforces it; the checkbox just reflects it
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
    columnHelper.accessor('orderNumber', {
      id: 'orderNumber',
      header: t('orderHash'),
      enableSorting: false,
      cell: (info) => <span className='font-medium'>#{info.getValue()}</span>,
    }),
    columnHelper.accessor('date', {
      id: 'date',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('placed')} />
      ),
      cell: (info) => {
        const value = info.getValue()
        if (!value) return '—'
        const date = new Date(value)
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{formatRelative(date, t, locale)}</span>
            </TooltipTrigger>
            <TooltipContent>{date.toLocaleString(locale)}</TooltipContent>
          </Tooltip>
        )
      },
    }),
    columnHelper.accessor('userName', {
      id: 'customer',
      header: t('customer'),
      enableSorting: false,
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor((row) => localized(row.roomName), {
      id: 'room',
      header: t('room'),
      enableSorting: false,
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor((row) => localized(row.tableName), {
      id: 'table',
      header: t('tables'),
      enableSorting: false,
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor('source', {
      id: 'source',
      header: t('source'),
      enableSorting: false,
      cell: (info) => {
        const key = info.getValue() ? orderSourceKeys[info.getValue()!] : null
        return key ? (
          <Badge variant='outline'>{t(key)}</Badge>
        ) : (
          <span className='text-muted-foreground'>—</span>
        )
      },
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: t('status'),
      enableSorting: false,
      cell: (info) => {
        const status = getOrderStatus(info.getValue())
        if (!status) return info.getValue() ?? '—'
        const Icon = status.icon
        return (
          <Badge variant={status.variant} className='gap-1'>
            <Icon className='h-3 w-3' />
            {t(status.key)}
          </Badge>
        )
      },
    }),
    columnHelper.accessor('total', {
      id: 'total',
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title={t('total')}
          className='justify-end'
        />
      ),
      cell: (info) => (
        <div className='text-end font-medium tabular-nums'>
          {formatEgp(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor('ratingValue', {
      id: 'rating',
      header: t('rating'),
      enableSorting: false,
      cell: (info) => {
        const rating = info.getValue()
        if (rating == null) return null
        return (
          <span className='text-warning' aria-label={`${rating}/5`}>
            {'★'.repeat(Number(rating))}
          </span>
        )
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const orderNumber = Number(row.original.orderNumber)
        return (
          <div
            className='flex justify-end gap-1'
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={t('orderNumber', { id: orderNumber })}
              onClick={() => onView(orderNumber)}
            >
              <Eye className='h-4 w-4' />
            </Button>
            {isCancelled(row.original.status) && (
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={t('delete')}
                disabled={isActing}
                onClick={() => onDelete(orderNumber)}
              >
                <Trash2 className='text-destructive h-4 w-4' />
              </Button>
            )}
          </div>
        )
      },
      meta: { className: 'w-[88px]' },
    }),
  ])
}
