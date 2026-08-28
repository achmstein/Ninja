import { Check, Eye, Trash2, X } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { createAppColumnHelper } from '@/components/data-table'
import {
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { formatEgp, getOrderStatus, isCancelled, isSubmitted } from './status'

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
  onConfirm: (orderNumber: number) => void
  onCancel: (orderNumber: number) => void
  onDelete: (orderNumber: number) => void
  isActing: boolean
  t: Translate
  localized: (text: { en?: string | null; ar?: string | null } | null | undefined) => string
  locale: string
}

export function getOrdersColumns({
  onView,
  onConfirm,
  onCancel,
  onDelete,
  isActing,
  t,
  localized,
  locale,
}: OrdersColumnsCallbacks) {
  return columnHelper.columns([
    columnHelper.accessor('orderNumber', {
      id: 'orderNumber',
      header: t('orderHash'),
      cell: (info) => <span className='font-medium'>#{info.getValue()}</span>,
    }),
    columnHelper.accessor('date', {
      id: 'date',
      header: t('placed'),
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
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.accessor((row) => localized(row.roomName), {
      id: 'room',
      header: t('room'),
      cell: (info) => localized(info.row.original.roomName) || '—',
    }),
    columnHelper.accessor('status', {
      id: 'status',
      header: t('status'),
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
    columnHelper.display({
      id: 'loyalty',
      header: t('loyalty'),
      cell: ({ row }) => {
        const discount = Number(row.original.loyaltyDiscount ?? 0)
        const points = Number(row.original.pointsToRedeem ?? 0)
        if (discount <= 0 && points <= 0) return null
        return (
          <span className='text-muted-foreground text-sm'>
            −{formatEgp(discount)} · {points} {t('points')}
          </span>
        )
      },
    }),
    columnHelper.accessor('total', {
      id: 'total',
      header: () => <div className='text-end'>{t('total')}</div>,
      cell: (info) => (
        <div className='text-end font-medium tabular-nums'>
          {formatEgp(info.getValue())}
        </div>
      ),
    }),
    columnHelper.accessor('ratingValue', {
      id: 'rating',
      header: t('rating'),
      cell: (info) => {
        const rating = info.getValue()
        if (rating == null) return null
        return (
          <span className='text-amber-500' aria-label={`Rated ${rating} of 5`}>
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
              aria-label={`View order ${orderNumber}`}
              onClick={() => onView(orderNumber)}
            >
              <Eye className='h-4 w-4' />
            </Button>
            {isSubmitted(row.original.status) && (
              <>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={`Confirm order ${orderNumber}`}
                  disabled={isActing}
                  onClick={() => onConfirm(orderNumber)}
                >
                  <Check className='h-4 w-4 text-green-600' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-8'
                  aria-label={`Cancel order ${orderNumber}`}
                  disabled={isActing}
                  onClick={() => onCancel(orderNumber)}
                >
                  <X className='text-destructive h-4 w-4' />
                </Button>
              </>
            )}
            {isCancelled(row.original.status) && (
              <Button
                variant='ghost'
                size='icon'
                className='size-8'
                aria-label={`Delete order ${orderNumber}`}
                disabled={isActing}
                onClick={() => onDelete(orderNumber)}
              >
                <Trash2 className='text-destructive h-4 w-4' />
              </Button>
            )}
          </div>
        )
      },
      meta: { className: 'w-[120px]' },
    }),
  ])
}
