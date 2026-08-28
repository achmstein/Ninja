import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Ban } from 'lucide-react'
import { type RoomViewModel } from '@/api/rooms'
import { listRoomsOptions } from '@/api/rooms/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useRoomsGroup } from '@/lib/hub'
import { useActiveSession, useMyReservation } from '@/lib/session'
import { useT } from '@/lib/i18n'
import { Skeleton } from '@/components/ui/skeleton'
import { useProfileGate } from '@/components/profile-gate'
import { ActiveSessionView } from '@/components/rooms/active-session'
import { NotifyBanner } from '@/components/rooms/notify-banner'
import { ReserveSheet } from '@/components/rooms/reserve-sheet'
import { ReservedBanner } from '@/components/rooms/reserved-banner'
import { RoomRow, ROOM_AVAILABLE } from '@/components/rooms/room-row'

export const Route = createFileRoute('/rooms')({
  component: RoomsPage,
})

function RoomsPage() {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const activeSession = useActiveSession()
  const reservation = useMyReservation()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [reserveRoom, setReserveRoom] = useState<RoomViewModel | null>(null)

  // Live RoomStatusChanged updates + 30s fallback poll (mobile parity)
  useRoomsGroup()
  const { data: rooms = [], isLoading } = useQuery({
    ...listRoomsOptions(),
    refetchInterval: 30_000,
  })

  // While playing, the whole tab is the session view (mobile parity)
  if (activeSession) {
    return <ActiveSessionView session={activeSession} />
  }

  const reservationsEnabled = branch?.isReservationsEnabled ?? true
  const canReserve = auth.isAuthenticated && !reservation && reservationsEnabled
  const allBusy =
    rooms.length > 0 &&
    rooms.every((room) => Number(room.displayStatus) !== ROOM_AVAILABLE)

  const handleReserve = async (room: RoomViewModel) => {
    if (!auth.isAuthenticated) {
      auth.signinRedirect()
      return
    }
    // One reservation at a time (mobile parity; the backend enforces it too)
    if (reservation || activeSession) return
    if (!(await ensureProfileComplete())) return
    setReserveRoom(room)
  }

  return (
    <div className='flex flex-col gap-3 p-4'>
      <h1 className='pt-2 text-2xl font-bold tracking-tight'>{t('rooms')}</h1>

      {!reservationsEnabled && (
        <div className='bg-destructive/10 text-destructive flex items-center gap-2 rounded-lg p-3 text-sm font-medium'>
          <Ban className='h-4 w-4 shrink-0' />
          {t('reservationsUnavailable')}
        </div>
      )}

      {reservation && <ReservedBanner session={reservation} />}
      {allBusy && !reservation && auth.isAuthenticated && <NotifyBanner />}

      {isLoading ? (
        <div className='flex flex-col gap-3'>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className='h-24 rounded-xl' />
          ))}
        </div>
      ) : (
        <div className='md:grid md:grid-cols-2 md:gap-x-10'>
          {rooms.map((room) => (
            <RoomRow
              key={String(room.id)}
              room={room}
              canReserve={canReserve}
              onReserve={handleReserve}
            />
          ))}
        </div>
      )}

      <ReserveSheet
        room={reserveRoom}
        onOpenChange={(open) => {
          if (!open) setReserveRoom(null)
        }}
      />
      {profileGateDialog}
    </div>
  )
}
