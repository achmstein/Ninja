import { useState } from 'react'
import { Armchair, DoorOpen, Plus, Search, ShoppingBag } from 'lucide-react'
import type { TicketSummary } from '@/api/sales/types.gen'
import type { ReservationViewModel, RoomViewModel, TableViewModel } from '@/api/spaces/types.gen'
import { Input } from '@/components/ui/input'
import {
  elapsedSeconds,
  formatClock,
  isActive,
  isReserved,
  ROOM_MAINTENANCE,
  roomStatusDot,
} from '@/features/rooms/status'
import { useSecondsClock } from '@/features/rooms/use-rooms'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

type PlaceListProps = {
  rooms: RoomViewModel[]
  sessionForRoom: (roomId: number | string | undefined) => ReservationViewModel | undefined
  tables: TableViewModel[]
  tickets: TicketSummary[]
  busy: boolean
  onNewTab: () => void
  onPickRoom: (room: RoomViewModel) => void
  onPickTable: (table: TableViewModel) => void
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className='text-muted-foreground mt-2 text-xs font-semibold tracking-wide uppercase'>
      {children}
    </h3>
  )
}

const rowClass =
  'hover:bg-accent/50 flex h-12 w-full items-center gap-3 rounded-lg px-3 text-start disabled:opacity-50'

/**
 * Every place that has no bill yet, as a narrow column beside the bills so
 * opening one is a single tap. It stays a list, searchable, so forty tables
 * and twelve rooms cost a scroll or a couple of letters, never the screen.
 * A room opens its controls (start a walk-in, start the reservation that
 * just arrived); a table opens a bill.
 */
export function PlaceList({
  rooms,
  sessionForRoom,
  tables,
  tickets,
  busy,
  onNewTab,
  onPickRoom,
  onPickTable,
}: PlaceListProps) {
  const t = useT()
  const localized = useLocalized()
  const [term, setTerm] = useState('')
  const nowMs = useSecondsClock(true)

  const needle = term.trim().toLowerCase()
  const matches = (name: { en?: string | null; ar?: string | null } | null | undefined) =>
    !needle ||
    (name?.en ?? '').toLowerCase().includes(needle) ||
    (name?.ar ?? '').toLowerCase().includes(needle)

  // A room with a bill is among the bills already; one without is here, in
  // whatever state it is in
  const freeRooms = rooms.filter(
    (room) =>
      matches(room.name) &&
      !tickets.some((ticket) => toNumber(ticket.roomId) === toNumber(room.id))
  )
  const freeTables = tables.filter(
    (table) =>
      table.isActive !== false &&
      matches(table.name) &&
      !tickets.some(
        (ticket) => ticket.type === 'Table' && toNumber(ticket.tableId) === toNumber(table.id)
      )
  )

  return (
    <div className='flex flex-col gap-1'>
      <div className='relative mb-1'>
        <Search className='text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2' />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t('searchPlaces')}
          className='h-11 ps-9 text-base'
          autoComplete='off'
        />
      </div>

      {!needle && (
        <button type='button' onClick={onNewTab} className={rowClass}>
          <Plus className='text-muted-foreground size-5' />
          <span className='flex-1 font-medium'>{t('newTab')}</span>
          <ShoppingBag className='text-muted-foreground size-4' />
        </button>
      )}

      {freeRooms.length > 0 && (
        <>
          <Heading>{t('rooms')}</Heading>
          {freeRooms.map((room) => {
            const session = sessionForRoom(room.id)
            const maintenance = Number(room.displayStatus) === ROOM_MAINTENANCE
            return (
              <button
                key={String(room.id)}
                type='button'
                disabled={maintenance || busy}
                onClick={() => onPickRoom(room)}
                className={rowClass}
              >
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    roomStatusDot[Number(room.displayStatus ?? 0)] ?? 'bg-muted'
                  )}
                />
                <span className='min-w-0 flex-1 truncate font-medium'>
                  {localized(room.name)}
                </span>
                <span className='text-muted-foreground truncate text-sm'>
                  {isActive(session)
                    ? formatClock(elapsedSeconds(session, nowMs))
                    : isReserved(session)
                      ? session.customerName || t('statusReserved')
                      : maintenance
                        ? t('underMaintenance')
                        : t('free')}
                </span>
                <DoorOpen className='text-muted-foreground size-4 shrink-0' />
              </button>
            )
          })}
        </>
      )}

      {freeTables.length > 0 && (
        <>
          <Heading>{t('tables')}</Heading>
          {freeTables.map((table) => (
            <button
              key={String(table.id)}
              type='button'
              disabled={busy}
              onClick={() => onPickTable(table)}
              className={rowClass}
            >
              <span className='size-2.5 shrink-0 rounded-full bg-green-500' />
              <span className='min-w-0 flex-1 truncate font-medium'>
                {localized(table.name)}
              </span>
              <Armchair className='text-muted-foreground size-4 shrink-0' />
            </button>
          ))}
        </>
      )}

      {freeRooms.length === 0 && freeTables.length === 0 && (
        <p className='text-muted-foreground py-6 text-center text-sm'>
          {needle ? t('noPlaceMatches') : t('everyPlaceHasABill')}
        </p>
      )}
    </div>
  )
}
