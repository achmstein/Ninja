import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Ban } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { useSelectedBranch } from '@/lib/branch'
import { useRoomsGroup } from '@/lib/hub'
import { PLACE_AVAILABLE } from '@/lib/places'
import { useMyHold } from '@/lib/stays'
import { useT } from '@/lib/i18n'
import { useBookablePlaces, useVisit, useVisitTab } from '@/lib/visit'
import { useProfileGate } from '@/components/profile-gate'
import { ActiveStayView } from '@/components/places/active-stay'
import { NotifyBanner } from '@/components/places/notify-banner'
import { HoldSheet } from '@/components/places/hold-sheet'
import { HeldBanner } from '@/components/places/held-banner'
import { PlaceRow, PlaceRowSkeleton } from '@/components/places/place-row'
import { ScanFooter } from '@/components/places/scan-footer'
import { ScanSheet } from '@/components/places/scan-sheet'
import { SignInSheet } from '@/components/sign-in-options'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/places')({
  component: PlacesPage,
  // ?scan={placeId}: a timed place's code just opened; the tab answers it
  // with a sheet from the bottom instead of a page of its own
  validateSearch: (search: Record<string, unknown>): { scan?: number } =>
    Number(search.scan) > 0 ? { scan: Number(search.scan) } : {},
})

/**
 * The second tab (docs/visit-tab.html): the places to book. A running
 * clock takes it over, since that is where the customer is. A scanned
 * table does not — people at a table book rooms — and lives behind its
 * chip in the bar instead. Where there is nothing to book the tab does not
 * exist, and an old link to it goes home. Orders keep their own tab.
 */
function PlacesPage() {
  const { seat, settling } = useVisit()
  const { visible } = useVisitTab()
  const navigate = useNavigate()
  const { scan } = Route.useSearch()

  useEffect(() => {
    if (!visible) navigate({ to: '/', replace: true })
  }, [visible, navigate])

  // The scan's sheet sits over whatever the tab shows, and the address
  // forgets the scan once it has been answered
  const scanSheet = scan ? (
    <ScanSheet
      placeId={scan}
      onDone={() => navigate({ to: '/places', search: {}, replace: true })}
    />
  ) : null

  if (!visible) return null
  // Until the stays answer, a skeleton: the list flashing up and then
  // giving way to the clock is worse than a moment of nothing
  if (settling) {
    return (
      <div className='flex flex-col gap-4 p-4'>
        <Skeleton className='mt-2 h-8 w-40' />
        <Skeleton className='h-44 w-full rounded-2xl' />
        <div className='grid grid-cols-2 gap-3'>
          <Skeleton className='h-16 rounded-2xl' />
          <Skeleton className='h-16 rounded-2xl' />
        </div>
      </div>
    )
  }
  return (
    <>
      {seat.kind === 'stay' ? (
        <ActiveStayView stay={seat.stay} />
      ) : (
        <PlacesList atTable={seat.kind === 'table'} />
      )}
      {scanSheet}
    </>
  )
}

/** The bookable places of the branch — the rooms and stations with a
 *  clock, and any table the owner opened to reservations — and the
 *  customer's reservation on one while they walk over. */
function PlacesList({ atTable }: { atTable: boolean }) {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const hold = useMyHold()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [reservePlace, setReservePlace] = useState<PlaceViewModel | null>(null)
  const [signInOpen, setSignInOpen] = useState(false)

  // Live RoomStatusChanged updates + 30s fallback poll (app parity)
  useRoomsGroup()
  const { data: places = [], isLoading } = useBookablePlaces()

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
    if (hold) return
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

      {hold && <HeldBanner reservation={hold} />}
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

      {/* Telling someone already at a table to scan a table is noise */}
      {!atTable && <ScanFooter />}

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
