import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  Clock,
  DoorOpen,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingOrdersStrip } from '@/features/orders/pending-orders'
import { ServiceRequestsStrip } from '@/features/requests/service-requests-strip'
import { RoomPanel } from '@/features/rooms/room-panel'
import {
  elapsedSeconds,
  formatClock,
  isActive,
  isReserved,
} from '@/features/rooms/status'
import { useRooms, useSecondsClock } from '@/features/rooms/use-rooms'
import { API_VERSION } from '@/lib/api-client'
import {
  pendingForTicket,
  usePendingOrders,
} from '@/features/orders/use-pending-orders'
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

/** One card per open bill: the place, its total, the running clock for a
 *  room, and a dot when an order is still waiting to be confirmed onto it. */
function BillCard({
  ticket,
  session,
  waiting,
  nowMs,
  onClick,
}: {
  ticket: TicketSummary
  session: ReservationViewModel | undefined
  waiting: boolean
  nowMs: number
  onClick: () => void
}) {
  const t = useT()
  const localized = useLocalized()
  const money = useMoney()

  const type = ticket.type ?? ''
  const Icon = typeIcon[type] ?? ShoppingBag
  const typeLabel =
    type === 'Room' ? t('room') : type === 'Table' ? t('table') : t('counter')
  const title = localized(ticket.locationName) || ticket.label || typeLabel

  const active = isActive(session)

  return (
    <button
      type='button'
      onClick={onClick}
      className='bg-card hover:bg-accent/50 flex min-h-28 flex-col gap-2 rounded-xl border p-3 text-start'
    >
      <div className='flex items-start gap-2'>
        <Icon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
        <span className='min-w-0 flex-1 truncate text-base font-semibold'>
          {title}
        </span>
        {waiting && (
          <span
            className='mt-1.5 size-2.5 shrink-0 rounded-full bg-amber-500'
            aria-label={t('waitingToConfirm')}
          />
        )}
      </div>

      {active && (
        <span className='text-muted-foreground font-mono text-sm tabular-nums'>
          {formatClock(elapsedSeconds(session, nowMs))}
        </span>
      )}

      <span className='mt-auto text-lg font-semibold tabular-nums'>
        {money(ticket.total)}
      </span>
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
  // The places column collapses so a busy floor gets the whole width; the
  // choice is remembered on this till (localStorage may be blocked — default open)
  const [placesOpen, setPlacesOpen] = useState(() => {
    try {
      return localStorage.getItem('pos.floor.places') !== 'closed'
    } catch {
      return true
    }
  })
  const togglePlaces = () => {
    setPlacesOpen((open) => {
      const next = !open
      try {
        localStorage.setItem('pos.floor.places', next ? 'open' : 'closed')
      } catch {
        // A private window or blocked storage — the toggle still works this session
      }
      return next
    })
  }
  const [filter, setFilter] = useState<'all' | 'Room' | 'Table' | 'Counter'>(
    'all'
  )

  const { data: tickets = [], isLoading } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    // Poll fallback in case the SignalR connection is silently dead
    refetchInterval: 20_000,
  })
  const { rooms, sessions, sessionForRoom } = useRooms()
  const { pending } = usePendingOrders()
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

  const counts = {
    all: bills.length,
    Room: bills.filter((b) => b.type === 'Room').length,
    Table: bills.filter((b) => b.type === 'Table').length,
    Counter: bills.filter((b) => b.type === 'Counter').length,
  }
  const shownBills = filter === 'all' ? bills : bills.filter((b) => b.type === filter)
  const waitingIds = new Set(
    bills
      .filter((b) => pendingForTicket(pending, b).length > 0)
      .map((b) => toNumber(b.id))
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
    <div
      className={
        placesOpen
          ? 'grid gap-6 p-4 md:grid-cols-[minmax(220px,1fr)_minmax(0,2.6fr)]'
          : 'grid gap-6 p-4'
      }
    >
      {/* Places with no bill yet — sticky, scrolling on its own, last on a
          phone where the bills matter more. Collapsed away when the cashier
          wants the full width; the header toggle brings it back. The scroll
          box clips anything outside its edges, so a hair of inner padding
          keeps the search box's focus ring whole. */}
      <aside
        hidden={!placesOpen}
        className='order-2 flex flex-col gap-2 md:order-1 md:sticky md:top-20 md:-mx-1 md:max-h-[calc(100svh-6rem)] md:overflow-y-auto md:px-1'
      >
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
          <div className='flex items-center gap-2'>
            <Button
              size='icon'
              variant='ghost'
              className='text-muted-foreground size-10'
              aria-label={placesOpen ? t('hidePlaces') : t('showPlaces')}
              aria-pressed={placesOpen}
              onClick={togglePlaces}
            >
              {placesOpen ? (
                <PanelLeftClose className='size-5 rtl:-scale-x-100' />
              ) : (
                <PanelLeftOpen className='size-5 rtl:-scale-x-100' />
              )}
            </Button>
            <h1 className='text-xl font-bold'>{t('openBills')}</h1>
          </div>
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
            <Button
              size='lg'
              variant='outline'
              className='size-12'
              aria-label={t('availability')}
              onClick={() => navigate({ to: '/availability' })}
            >
              <PackageCheck className='size-5' />
            </Button>
          </div>
        </div>

        {/* A customer in a room is waiting on each of these, so they lead the
            floor; the strip is gone when nothing is pending */}
        <ServiceRequestsStrip />

        {/* App orders waiting for a tap come next: someone is waiting on
            each of them, and the strip is gone when nobody is */}
        <PendingOrdersStrip />

        {reserved.length > 0 && (
          <div className='flex flex-col gap-2'>
            <Heading>{t('statusReserved')}</Heading>
            <div className='flex gap-3 overflow-x-auto pb-1'>
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
                    className='bg-card hover:bg-accent/50 flex w-[240px] shrink-0 items-center gap-3 rounded-xl border p-3 text-start shadow-xs'
                  >
                    <div className='flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10'>
                      <Clock className='size-5 text-amber-600 dark:text-amber-500' />
                    </div>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-base font-semibold'>
                        {localized(room?.name ?? session.roomName)}
                      </span>
                      <span className='text-muted-foreground block truncate text-sm'>
                        {session.customerName || t('statusReserved')}
                      </span>
                    </span>
                    {expiresIn != null && (
                      <span className='font-mono text-sm text-amber-600 tabular-nums shrink-0 dark:text-amber-500'>
                        {formatClock(expiresIn).slice(3)}
                      </span>
                    )}
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
          <div className='flex flex-col gap-3'>
            <div className='flex flex-wrap gap-2'>
              {(['all', 'Room', 'Table', 'Counter'] as const).map((key) => {
                if (key !== 'all' && counts[key] === 0) return null
                const label =
                  key === 'all'
                    ? t('allBills')
                    : key === 'Room'
                      ? t('rooms')
                      : key === 'Table'
                        ? t('tables')
                        : t('counter')
                return (
                  <Button
                    key={key}
                    type='button'
                    size='lg'
                    variant={filter === key ? 'default' : 'outline'}
                    onClick={() => setFilter(key)}
                    className='gap-2 rounded-full'
                  >
                    {label}
                    <Badge variant='secondary' className='tabular-nums'>
                      {counts[key]}
                    </Badge>
                  </Button>
                )
              })}
            </div>

            {/* Rounded cards cap at ~220px so a lone bill stays a normal card,
                not a full-width banner, and the row fills left to right */}
            <div className='grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-3'>
              {shownBills.map((ticket) => (
                <BillCard
                  key={String(ticket.id)}
                  ticket={ticket}
                  session={sessionForTicket(ticket)}
                  waiting={waitingIds.has(toNumber(ticket.id))}
                  nowMs={nowMs}
                  onClick={() => toTicket(ticket)}
                />
              ))}
            </div>
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
