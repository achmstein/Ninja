import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Gamepad2, History, Wrench } from 'lucide-react'
import {
  type ReservationViewModel,
  type RoomViewModel,
} from '@/api/rooms'
import {
  getActiveSessionsOptions,
  listRoomsOptions,
} from '@/api/rooms/@tanstack/react-query.gen'
import { cn } from '@/lib/utils'
import {
  useLocalized,
  useT,
  type TranslationKey,
  type TranslateParams,
} from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ReserveRoomDialog } from './components/reserve-room-dialog'
import { RoomDetailPanel } from './components/room-detail-panel'
import { StartReservedDialog } from './components/start-reserved-dialog'
import { StartSessionDialog } from './components/start-session-dialog'
import {
  ROOM_AVAILABLE,
  ROOM_MAINTENANCE,
  roomStatusConfig,
  SESSION_ACTIVE,
  SESSION_RESERVED,
} from './status'

const route = getRouteApi('/_authenticated/rooms/')

const statusFilters: { value: string; key: TranslationKey }[] = [
  { value: 'all', key: 'allRooms' },
  { value: '1', key: 'statusAvailable' },
  { value: '2', key: 'statusOccupied' },
  { value: '3', key: 'statusReserved' },
  { value: '4', key: 'statusMaintenance' },
]

/** One-line summary under the room name in the master list. */
function roomSubline(
  room: RoomViewModel,
  session: ReservationViewModel | undefined,
  t: (key: TranslationKey, params?: TranslateParams) => string
): string {
  if (session && Number(session.status) === SESSION_ACTIVE) {
    const who = session.customerName || t('walkIn')
    return session.currentPlayerMode
      ? `${who} · ${t(session.currentPlayerMode === 'Multi' ? 'playerModeMulti' : 'playerModeSingle')}`
      : who
  }
  if (session && Number(session.status) === SESSION_RESERVED) {
    return session.customerName
      ? t('reservedFor', { name: session.customerName })
      : t('reserved')
  }
  if (Number(room.displayStatus) === ROOM_MAINTENANCE) {
    return t('statusMaintenance')
  }
  return t('dualRateFormat', {
    singleRate: String(Number(room.singleRate ?? 0)),
    multiRate: String(Number(room.multiRate ?? 0)),
  })
}

/** Rooms as a master-detail split (shadcn-admin chats pattern): room list on
 *  the start side, the selected room's live state + history on the end side. */
export function RoomsManagement() {
  const t = useT()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const [walkInRoom, setWalkInRoom] = useState<RoomViewModel | null>(null)
  const [reserveRoom, setReserveRoom] = useState<RoomViewModel | null>(null)
  const [startReserved, setStartReserved] =
    useState<ReservationViewModel | null>(null)
  const [status, setStatus] = useState('all')

  const { data: rooms = [], isLoading: loadingRooms } = useQuery(
    listRoomsOptions()
  )

  const { data: activeSessions = [] } = useQuery({
    ...getActiveSessionsOptions(),
    // SignalR is the primary update path; this poll is only a fallback
    refetchInterval: 60_000,
  })

  const getRoomSession = (
    roomId: number | string | undefined
  ): ReservationViewModel | undefined =>
    activeSessions.find(
      (s) =>
        Number(s.roomId) === Number(roomId) &&
        (Number(s.status) === SESSION_ACTIVE ||
          Number(s.status) === SESSION_RESERVED)
    )

  const selectedRoom = rooms.find((r) => Number(r.id) === search.room)
  const selectedSession = getRoomSession(search.room)

  const select = (roomId: number | undefined) =>
    navigate({ search: (prev) => ({ ...prev, room: roomId }) })

  const visibleRooms = useMemo(() => {
    return rooms
      .filter(
        (room) =>
          status === 'all' || Number(room.displayStatus) === Number(status)
      )
      .sort((a, b) => (a.name?.en ?? '').localeCompare(b.name?.en ?? ''))
  }, [rooms, status])

  return (
    <>
      <Header />

      <Main fixed>
        <section className='relative flex h-full gap-6'>
          {/* Master: room list */}
          <div className='flex w-full flex-col gap-2 sm:w-56 lg:w-72 2xl:w-80'>
            <div className='flex items-start justify-between py-2'>
              <div>
                <h1 className='text-2xl font-bold tracking-tight'>
                  {t('rooms')}
                </h1>
                <p className='text-muted-foreground text-sm'>
                  {t('roomsSubtitle')}
                </p>
              </div>
              <Button size='icon' variant='ghost' asChild>
                <Link to='/rooms/history' aria-label={t('allSessionHistory')}>
                  <History size={20} className='stroke-muted-foreground' />
                </Link>
              </Button>
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size='sm' className='w-full'>
                <SelectValue>
                  {t(
                    statusFilters.find((s) => s.value === status)?.key ??
                      'allRooms'
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <ScrollArea className='-mx-3 h-full p-3'>
              {loadingRooms
                ? [...Array(6)].map((_, i) => (
                    <Skeleton key={i} className='mb-2 h-14 rounded-md' />
                  ))
                : visibleRooms.map((room) => {
                    const session = getRoomSession(room.id)
                    const roomStatus =
                      roomStatusConfig[Number(room.displayStatus ?? 0)] ??
                      roomStatusConfig[ROOM_AVAILABLE]
                    const selected = Number(room.id) === search.room
                    return (
                      <button
                        key={String(room.id)}
                        type='button'
                        className={cn(
                          'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-start text-sm',
                          selected && 'sm:bg-muted'
                        )}
                        onClick={() => select(Number(room.id))}
                      >
                        <div className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-md'>
                          {Number(room.displayStatus) === ROOM_MAINTENANCE ? (
                            <Wrench className='size-4' />
                          ) : (
                            <Gamepad2 className='size-4' />
                          )}
                        </div>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate font-medium'>
                            {localized(room.name)}
                          </div>
                          <div className='text-muted-foreground truncate text-xs'>
                            {roomSubline(room, session, t)}
                          </div>
                        </div>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${roomStatus.dotClass}`}
                        />
                      </button>
                    )
                  })}
            </ScrollArea>
          </div>

          {/* Detail */}
          {selectedRoom ? (
            <div
              className={cn(
                'absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col border bg-background shadow-xs transition-all duration-200 sm:static sm:z-auto sm:flex sm:rounded-md',
                // start-0 (NOT the nonexistent inset-s-0) pulls the panel
                // on-screen — on mobile it overlays the list full-screen
                'start-0 flex'
              )}
            >
              <RoomDetailPanel
                key={String(selectedRoom.id)}
                room={selectedRoom}
                session={selectedSession}
                onBack={() => select(undefined)}
                onWalkIn={() => setWalkInRoom(selectedRoom)}
                onReserve={() => setReserveRoom(selectedRoom)}
                onStartReserved={setStartReserved}
              />
            </div>
          ) : (
            <div className='absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col justify-center rounded-md border bg-card shadow-xs sm:static sm:z-auto sm:flex'>
              <div className='flex flex-col items-center space-y-6'>
                <div className='border-border flex size-16 items-center justify-center rounded-full border-2'>
                  <Gamepad2 className='size-8' />
                </div>
                <div className='space-y-2 text-center'>
                  <h2 className='text-xl font-semibold'>{t('selectRoom')}</h2>
                  <p className='text-muted-foreground text-sm'>
                    {t('selectRoomHint')}
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </Main>

      <StartSessionDialog
        room={walkInRoom}
        onOpenChange={(open) => {
          if (!open) setWalkInRoom(null)
        }}
      />

      <ReserveRoomDialog
        room={reserveRoom}
        onOpenChange={(open) => {
          if (!open) setReserveRoom(null)
        }}
      />

      <StartReservedDialog
        session={startReserved}
        onOpenChange={(open) => {
          if (!open) setStartReserved(null)
        }}
      />
    </>
  )
}
