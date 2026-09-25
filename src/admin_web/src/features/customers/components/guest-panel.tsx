import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { type GuestSummary } from '@/api/ordering'
import {
  getAllOrdersOptions,
  getGuestsOptions,
} from '@/api/ordering/@tanstack/react-query.gen'
import { API_VERSION } from '@/lib/api-client'
import { useLocale, useT } from '@/lib/i18n'
import { whatsAppLink } from '@/lib/phone'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import { OrderDetailsSheet } from '@/features/orders/components/order-details-sheet'
import {
  formatEgp,
  getOrderStatus,
  relativeTime,
} from '@/features/orders/status'
import { useOrderActions } from '@/features/orders/use-order-actions'

type GuestPanelProps = {
  guestKey: string
  /** The row as the list already has it; looked up afresh when it doesn't */
  guest?: GuestSummary
  onBack: () => void
}

/**
 * The end side of the customers split for someone with no account: who
 * they said they were, how often they came and what they spent, and every
 * order they left — each opens the same ticket the orders page does.
 */
export function GuestPanel({ guestKey, guest, onBack }: GuestPanelProps) {
  const t = useT()
  const locale = useLocale()
  const [nowMs] = useState(() => Date.now())
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const { confirm, cancel, isActing } = useOrderActions()

  // A link to /customers?filter=guests&guest=… opens before the list has
  // that page; the key is the phone's digits, so a search finds the row
  const lookup = useQuery({
    ...getGuestsOptions({
      query: { 'api-version': API_VERSION, search: guestKey, pageSize: 50 },
    }),
    enabled: !guest,
  })
  const summary =
    guest ?? lookup.data?.items?.find((g) => g.key === guestKey) ?? undefined

  const orders = useQuery(
    getAllOrdersOptions({
      query: {
        'api-version': API_VERSION,
        guest: guestKey,
        pageIndex: 0,
        pageSize: 50,
      },
    })
  )
  const rows = orders.data?.items ?? []

  const name = summary?.name || t('guestBadge')
  const phone = summary?.phone ?? undefined
  const date = (value?: string) =>
    value ? new Date(value).toLocaleDateString(locale) : '—'

  return (
    <div className='flex h-full flex-col'>
      <div className='flex flex-none items-center gap-3 border-b p-4'>
        <Button
          size='icon'
          variant='ghost'
          className='-ms-2 sm:hidden'
          onClick={onBack}
          aria-label={t('guests')}
        >
          <ArrowLeft className='rtl:rotate-180' />
        </Button>
        <Avatar className='size-10'>
          <AvatarFallback className='bg-muted text-muted-foreground'>
            {name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <h2 className='truncate text-sm font-semibold'>{name}</h2>
            <Badge variant='outline'>{t('guestBadge')}</Badge>
          </div>
          {phone && (
            <p className='text-muted-foreground flex items-center gap-1 truncate text-xs'>
              <span dir='ltr'>{phone}</span>
              {/* The guest on WhatsApp: their phone is the only way to reach them */}
              <a
                href={whatsAppLink(phone)}
                target='_blank'
                rel='noreferrer'
                aria-label='WhatsApp'
                className='text-emerald-600'
              >
                <MessageCircle className='size-3.5' />
              </a>
            </p>
          )}
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto'>
        {summary ? (
          <dl className='grid grid-cols-2 gap-4 border-b p-4 text-sm lg:grid-cols-4'>
            <div>
              <dt className='text-muted-foreground text-xs'>{t('orders')}</dt>
              <dd className='font-semibold tabular-nums'>
                {Number(summary.orderCount ?? 0).toLocaleString(locale)}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-xs'>
                {t('totalSpent')}
              </dt>
              <dd className='font-semibold tabular-nums'>
                {formatEgp(summary.totalSpent)}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-xs'>
                {t('firstOrder')}
              </dt>
              <dd className='font-medium'>{date(summary.firstOrderAt)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-xs'>
                {t('lastOrder')}
              </dt>
              <dd className='font-medium'>
                {relativeTime(summary.lastOrderAt, nowMs, t, locale)}
              </dd>
            </div>
          </dl>
        ) : (
          lookup.isLoading && <Skeleton className='m-4 h-12' />
        )}

        <section className='space-y-2 p-4'>
          <p className='text-muted-foreground text-xs'>{t('guestNoAccount')}</p>
          <h3 className='pt-2 text-sm font-medium'>{t('orders')}</h3>
          {orders.isError ? (
            <ErrorState error={orders.error} onRetry={() => orders.refetch()} />
          ) : orders.isLoading ? (
            <div className='space-y-2'>
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className='h-8' />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className='text-muted-foreground text-sm'>{t('noOrdersYet')}</p>
          ) : (
            <ul className='divide-y text-sm'>
              {rows.map((order) => {
                const status = getOrderStatus(order.status)
                return (
                  <li key={String(order.orderNumber)}>
                    <button
                      type='button'
                      className='hover:bg-accent flex w-full items-center justify-between gap-2 rounded-md px-1 py-2 text-start'
                      onClick={() =>
                        setSelectedOrderId(Number(order.orderNumber))
                      }
                    >
                      {/* Two flex items, so the bidi algorithm never merges
                          the order number's digits into the date's in RTL */}
                      <div className='flex min-w-0 items-baseline gap-2'>
                        <span className='font-medium' dir='ltr'>
                          #{order.orderNumber}
                        </span>
                        <span className='text-muted-foreground text-xs'>
                          {date(order.date)}
                        </span>
                      </div>
                      <div className='flex shrink-0 items-center gap-2'>
                        {status && (
                          <Badge variant={status.variant}>
                            {t(status.key)}
                          </Badge>
                        )}
                        <span className='font-medium tabular-nums'>
                          {formatEgp(order.total)}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <OrderDetailsSheet
        orderId={selectedOrderId}
        onOpenChange={(open) => {
          if (!open) setSelectedOrderId(null)
        }}
        onConfirm={confirm}
        onCancel={cancel}
        isActing={isActing}
      />
    </div>
  )
}
