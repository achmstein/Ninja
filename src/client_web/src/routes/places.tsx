import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Ban } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { listPlacesOptions } from '@/api/spaces/@tanstack/react-query.gen'
import { useSelectedBranch } from '@/lib/branch'
import { useRoomsGroup } from '@/lib/hub'
import { PLACE_AVAILABLE } from '@/lib/places'
import { useActiveStay, useMyHold } from '@/lib/stays'
import { useT } from '@/lib/i18n'
import { useProfileGate } from '@/components/profile-gate'
import { ActiveStayView } from '@/components/places/active-stay'
import { NotifyBanner } from '@/components/places/notify-banner'
import { HoldSheet } from '@/components/places/hold-sheet'
import { HeldBanner } from '@/components/places/held-banner'
import { PlaceRow, PlaceRowSkeleton } from '@/components/places/place-row'
import { SignInSheet } from '@/components/sign-in-options'

export const Route = createFileRoute('/places')({
  component: PlacesPage,
})

/**
 * The timed places of the branch — the PlayStation rooms and any table or
 * station with a clock — and the customer's own place in them: the list to
 * pick from, the hold while they walk over, the running clock once the
 * counter starts it. The whole tab changes with that state, so its name
 * never promises something already done.
 */
function PlacesPage() {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const activeStay = useActiveStay()
  const hold = useMyHold()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [reservePlace, setReservePlace] = useState<PlaceViewModel | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)

  // Live RoomStatusChanged updates + 30s fallback poll (app parity)
  useRoomsGroup()
  const { data: places = [], isLoading } = useQuery({
    ...listPlacesOptions({ query: { timed: true } }),
    refetchInterval: 30_000,
    // A place taken out of service is not on the customer's list
    select: (list) => list.filter((p) => p.isActive !== false),
  })

  // While the clock runs, the whole tab is the stay view (app parity)
  if (activeStay) {
    return <ActiveStayView stay={activeStay} />
  }

  const reservationsEnabled = branch?.isReservationsEnabled ?? true
  const canReserve = auth.isAuthenticated && !hold && reservationsEnabled
  const allBusy =
    places.length > 0 &&
    places.every((p) => Number(p.status) !== PLACE_AVAILABLE)

  const handleReserve = async (place: PlaceViewModel) => {
    if (!auth.isAuthenticated) {
      setSignInOpen(true)
      return
    }
    // One hold at a time (app parity; the backend enforces it too)
    if (hold || activeStay) return
    if (!(await ensureProfileComplete())) return
    setReservePlace(place)
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

      {hold && <HeldBanner stay={hold} />}
      {allBusy && !hold && auth.isAuthenticated && <NotifyBanner />}

      {isLoading ? (
        <div className='flex flex-col'>
          {[...Array(4)].map((_, i) => (
            <PlaceRowSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className='md:grid md:grid-cols-2 md:gap-x-10'>
          {places.map((place) => (
            <PlaceRow
              key={String(place.id)}
              place={place}
              canReserve={canReserve}
              onReserve={handleReserve}
            />
          ))}
        </div>
      )}

      <HoldSheet
        place={reservePlace}
        onOpenChange={(open) => {
          if (!open) setReservePlace(null)
        }}
      />
      {profileGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </div>
  )
}
