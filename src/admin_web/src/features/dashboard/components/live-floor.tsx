import { Link } from '@tanstack/react-router'
import { Armchair, Check, MapPin } from 'lucide-react'
import { type OrderSummary } from '@/api/ordering'
import { type ReservationViewModel, type RoomViewModel } from '@/api/spaces'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/error-state'
import {
  formatEgp,
  orderUrgency,
  relativeTime,
  urgencyTextClass,
} from '@/features/orders/status'
import { useOrderActions } from '@/features/orders/use-order-actions'

const MAX_ROWS = 6

function elapsed(since: string | null | undefined, nowMs: number): string {
  if (!since) return ''
  const s = Math.max(0, Math.floor((nowMs - new Date(since).getTime()) / 1000))
  const hh = String(Math.floor(s / 3600)).padStart(2, '0')
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  return `${hh}:${mm}`
}

type LiveFloorProps = {
  sessions: ReservationViewModel[]
  rooms: RoomViewModel[]
  pending: OrderSummary[]
  nowMs: number
  isLoading: boolean
  error: unknown
  onRetry: () => void
}

/**
 * What is happening on the floor right now: rooms with a running clock, and
 * the orders waiting with Confirm in reach. Rows, not cards — each links to
 * the page that owns it.
 */
export function LiveFloor({
  sessions,
  rooms,
  pending,
  nowMs,
  isLoading,
  error,
  onRetry,
}: LiveFloorProps) {
  const t = useT()
  const locale = useLocale()
  const localized = useLocalized()
  const { confirm, actingOrderNumber } = useOrderActions()

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  return (
    <section className='flex flex-col gap-6'>
      <div>
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='text-sm font-semibold'>
            {t('activeSessions')}
            {sessions.length > 0 && (
              <span className='text-muted-foreground ms-2 font-normal tabular-nums'>
                {sessions.length}
              </span>
            )}
          </h2>
          <Button variant='link' size='sm' className='h-auto p-0' asChild>
            <Link to='/rooms'>{t('viewAll')}</Link>
          </Button>
        </div>
        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10' />
            <Skeleton className='h-10' />
          </div>
        ) : sessions.length === 0 ? (
          <p className='text-muted-foreground py-3 text-sm'>
            {t('noActiveSessions')}
          </p>
        ) : (
          <ul className='divide-y'>
            {sessions.slice(0, MAX_ROWS).map((session) => {
              const room = rooms.find(
                (r) => Number(r.id) === Number(session.roomId)
              )
              return (
                <li key={String(session.id)}>
                  <Link
                    to='/rooms'
                    search={{ room: Number(session.roomId) }}
                    className='hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors'
                  >
                    <span className='bg-success size-2 shrink-0 rounded-full' />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {localized(room?.name) || localized(session.roomName)}
                      </span>
                      <span className='text-muted-foreground block truncate text-xs'>
                        {session.customerName || t('walkIn')}
                        {session.currentPlayerMode &&
                          ` · ${t(
                            session.currentPlayerMode === 'Multi'
                              ? 'playerModeMulti'
                              : 'playerModeSingle'
                          )}`}
                      </span>
                    </span>
                    <span className='font-mono text-sm tabular-nums'>
                      {elapsed(session.actualStartTime, nowMs)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <div className='mb-2 flex items-center justify-between'>
          <h2 className='text-sm font-semibold'>
            {t('pendingOrders')}
            {pending.length > 0 && (
              <span className='text-muted-foreground ms-2 font-normal tabular-nums'>
                {pending.length}
              </span>
            )}
          </h2>
          <Button variant='link' size='sm' className='h-auto p-0' asChild>
            <Link to='/orders'>{t('viewAll')}</Link>
          </Button>
        </div>
        {isLoading ? (
          <div className='space-y-2'>
            <Skeleton className='h-10' />
            <Skeleton className='h-10' />
          </div>
        ) : pending.length === 0 ? (
          <p className='text-muted-foreground py-3 text-sm'>
            {t('noPendingOrders')}
          </p>
        ) : (
          <ul className='divide-y'>
            {pending.slice(0, MAX_ROWS).map((order) => {
              const urgency = orderUrgency(order.date, nowMs)
              const place =
                localized(order.roomName) || localized(order.tableName)
              const PlaceIcon = localized(order.roomName) ? MapPin : Armchair
              const acting =
                Number(actingOrderNumber) === Number(order.orderNumber)
              return (
                <li
                  key={String(order.orderNumber)}
                  className='flex items-center gap-3 py-2 text-sm'
                >
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-2'>
                      <span className='font-medium'>#{order.orderNumber}</span>
                      {place && (
                        <Badge
                          variant='outline'
                          className='h-5 gap-1 px-1.5 text-[11px] font-normal'
                        >
                          <PlaceIcon className='size-3' />
                          {place}
                        </Badge>
                      )}
                    </span>
                    <span className='text-muted-foreground block truncate text-xs'>
                      {order.userName || t('guest')} ·{' '}
                      <span className={urgencyTextClass(urgency)}>
                        {relativeTime(order.date, nowMs, t, locale)}
                      </span>
                    </span>
                  </span>
                  <span className='tabular-nums'>{formatEgp(order.total)}</span>
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-8'
                    disabled={acting}
                    onClick={() => confirm(Number(order.orderNumber))}
                  >
                    <Check className='size-4' />
                    {t('confirm')}
                  </Button>
                </li>
              )
            })}
            {pending.length > MAX_ROWS && (
              <li className='py-2 text-center'>
                <Button variant='link' size='sm' asChild>
                  <Link to='/orders'>
                    {t('viewAllOrdersCount', { count: pending.length })}
                  </Link>
                </Button>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  )
}
