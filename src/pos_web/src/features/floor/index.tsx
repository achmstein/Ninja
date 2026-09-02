import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  ChevronRight,
  Clock,
  DoorOpen,
  ReceiptText,
  ShoppingBag,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import {
  getOpenTicketsOptions,
  openTicketMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { TicketSummary } from '@/api/sales/types.gen'
import { listTablesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import type { ReservationViewModel, RoomViewModel, TableViewModel } from '@/api/spaces/types.gen'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingOrdersStrip } from '@/features/orders/pending-orders'
import { RoomPanel } from '@/features/rooms/room-panel'
import {
  elapsedSeconds,
  formatClock,
  isActive,
  isReserved,
} from '@/features/rooms/status'
import { useRooms, useSecondsClock } from '@/features/rooms/use-rooms'
import { API_VERSION } from '@/lib/api-client'
import { useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { TICKET_TYPE_TABLE } from '@/lib/ticket-types'
import { NewTicketDialog } from './new-ticket-dialog'
import { PlaceList } from './place-list'

const typeIcon: Record<string, LucideIcon> = {
  Room: DoorOpen,
  Table: Armchair,
  Counter: ShoppingBag,
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
      {children}
    </h2>
  )
}

/** One line per open bill: where it is, what is on it, what it comes to — and the clock if a room is running. */
function BillRow({
  ticket,
  session,
  nowMs,
  onClick,
}: {
  ticket: TicketSummary
  session: ReservationViewModel | undefined
  nowMs: number
  onClick: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  const Icon = typeIcon[ticket.type ?? ''] ?? ShoppingBag
  const typeLabel =
    ticket.type === 'Room' ? t('room') : ticket.type === 'Table' ? t('table') : t('counter')
  const title = localized(ticket.locationName) || ticket.label || typeLabel

  return (
    <button
      type='button'
      onClick={onClick}
      className='hover:bg-accent/50 flex h-16 w-full items-center gap-3 px-3 text-start'
    >
      <Icon className='text-muted-foreground size-5 shrink-0' />
      <span className='min-w-0 flex-1'>
        <span className='block truncate text-base font-medium'>{title}</span>
        <span className='text-muted-foreground block truncate text-sm'>
          {t('linesCount', { count: toNumber(ticket.lineCount) })}
        </span>
      </span>
      {isActive(session) && (
        <span className='text-muted-foreground font-mono text-sm tabular-nums'>
          {formatClock(elapsedSeconds(session, nowMs))}
        </span>
      )}
      <span className='shrink-0 text-lg font-semibold tabular-nums'>
        {money(ticket.total)}
      </span>
      <ChevronRight className='text-muted-foreground size-5 shrink-0 rtl:rotate-180' />
    </button>
  )
}

/**
 * Two columns. The narrow one is the searchable list of places with no bill
 * yet, always in reach so opening one is a single tap. The wide one is what
 * is happening: app orders waiting for a tap, reservations about to arrive,
 * and the open bills by last activity. Neither grows with the size of the
 * building — the list scrolls and searches, the bills are only the open ones.
 */
export function Floor() {
  const t = useT()
  const localized = useLocalized()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [newTabOpen, setNewTabOpen] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)

  const { data: tickets = [], isLoading } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    // Poll fallback in case the SignalR connection is silently dead
    refetchInterval: 20_000,
  })
  const { rooms, sessions, sessionForRoom } = useRooms()
  const { data: tables = [] } = useQuery(listTablesOptions())

  const openTable = useMutation({
    ...openTicketMutation(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getOpenTickets' }] })
      navigate({
        to: '/ticket/$ticketId',
        params: { ticketId: String(result.ticketId) },
      })
    },
  })

  const toTicket = (ticket: TicketSummary) =>
    navigate({
      to: '/ticket/$ticketId',
      params: { ticketId: String(toNumber(ticket.id)) },
    })

  const sessionForTicket = (ticket: TicketSummary) =>
    ticket.sessionId == null
      ? undefined
      : sessions.find((s) => toNumber(s.id) === toNumber(ticket.sessionId))

  // Reservations are the one thing not yet a bill that the cashier must not
  // miss: somebody is on their way
  const reserved = sessions.filter((session) => isReserved(session))
  const running = tickets.some((ticket) => isActive(sessionForTicket(ticket)))
  const nowMs = useSecondsClock(running || reserved.length > 0)

  // Bills by last activity: what just happened is what the cashier is
  // about to be asked about
  const bills = [...tickets].sort(
    (a, b) =>
      new Date(b.lastActivityAt ?? 0).getTime() -
      new Date(a.lastActivityAt ?? 0).getTime()
  )

  const selectedRoom =
    rooms.find((room) => toNumber(room.id) === selectedRoomId) ?? null

  const pickTable = (table: TableViewModel) =>
    openTable.mutate({
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_TABLE,
        tableId: toNumber(table.id),
        tableName: table.name,
      },
    })

  return (
    <div className='grid gap-6 p-4 md:grid-cols-[minmax(220px,1fr)_minmax(0,2.6fr)]'>
      {/* Places with no bill yet — sticky, scrolling on its own, last on a
          phone where the bills matter more. The scroll box clips anything
          outside its edges, so a hair of inner padding keeps the search
          box's focus ring whole. */}
      <aside className='order-2 flex flex-col gap-2 md:order-1 md:sticky md:top-20 md:-mx-1 md:max-h-[calc(100svh-6rem)] md:overflow-y-auto md:px-1'>
        <Heading>{t('openPlace')}</Heading>
        <PlaceList
          rooms={rooms}
          sessionForRoom={sessionForRoom}
          tables={tables}
          tickets={tickets}
          busy={openTable.isPending}
          onNewTab={() => setNewTabOpen(true)}
          onPickRoom={(room: RoomViewModel) => setSelectedRoomId(toNumber(room.id))}
          onPickTable={pickTable}
        />
      </aside>

      <section className='order-1 flex min-w-0 flex-col gap-5 md:order-2'>
        <div className='flex items-center justify-between gap-3'>
          <h1 className='text-xl font-bold'>{t('openBills')}</h1>
          <div className='flex gap-2'>
            <Button
              size='lg'
              className='h-12 gap-2 px-5 text-base'
              onClick={() => navigate({ to: '/sale' })}
            >
              <ShoppingCart className='size-5' />
              {t('newSale')}
            </Button>
            <Button
              size='lg'
              variant='outline'
              className='size-12'
              aria-label={t('receipts')}
              onClick={() => navigate({ to: '/receipts' })}
            >
              <ReceiptText className='size-5' />
            </Button>
          </div>
        </div>

        {/* App orders waiting for a tap come first: someone is waiting on
            each of them, and the strip is gone when nobody is */}
        <PendingOrdersStrip />

        {reserved.length > 0 && (
          <div className='flex flex-col gap-2'>
            <Heading>{t('statusReserved')}</Heading>
            <div className='bg-card divide-y overflow-hidden rounded-xl border'>
              {reserved.map((session) => {
                const room = rooms.find((r) => toNumber(r.id) === toNumber(session.roomId))
                const expiresIn = session.expiresAt
                  ? Math.max(0, (new Date(session.expiresAt).getTime() - nowMs) / 1000)
                  : null
                return (
                  <button
                    key={String(session.id)}
                    type='button'
                    onClick={() => setSelectedRoomId(toNumber(session.roomId))}
                    className='hover:bg-accent/50 flex h-14 w-full items-center gap-3 px-3 text-start'
                  >
                    <Clock className='size-5 shrink-0 text-amber-600 dark:text-amber-500' />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate font-medium'>
                        {localized(room?.name ?? session.roomName)}
                      </span>
                      {session.customerName && (
                        <span className='text-muted-foreground block truncate text-sm'>
                          {session.customerName}
                        </span>
                      )}
                    </span>
                    {expiresIn != null && (
                      <span className='font-mono text-sm text-amber-600 tabular-nums dark:text-amber-500'>
                        {formatClock(expiresIn).slice(3)}
                      </span>
                    )}
                    <ChevronRight className='text-muted-foreground size-5 shrink-0 rtl:rotate-180' />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <Skeleton className='h-48 rounded-xl' />
        ) : bills.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-1 py-20 text-center'>
            <p className='text-lg font-medium'>{t('noOpenBills')}</p>
            <p className='text-sm'>{t('noOpenBillsHint')}</p>
          </div>
        ) : (
          <div className='bg-card divide-y overflow-hidden rounded-xl border'>
            {bills.map((ticket) => (
              <BillRow
                key={String(ticket.id)}
                ticket={ticket}
                session={sessionForTicket(ticket)}
                nowMs={nowMs}
                onClick={() => toTicket(ticket)}
              />
            ))}
          </div>
        )}
      </section>

      <NewTicketDialog open={newTabOpen} onOpenChange={setNewTabOpen} />
      <RoomPanel
        room={selectedRoom}
        session={selectedRoom ? sessionForRoom(selectedRoom.id) : undefined}
        onOpenChange={(open) => {
          if (!open) setSelectedRoomId(null)
        }}
      />
    </div>
  )
}
