import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useMotionValue } from 'motion/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Ban } from 'lucide-react'
import { type PlaceViewModel } from '@/api/spaces'
import { useSelectedBranch } from '@/lib/branch'
import { useRoomsGroup } from '@/lib/hub'
import { PLACE_AVAILABLE } from '@/lib/places'
import { useMyHold } from '@/lib/stays'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { useBookablePlaces, useVisit, useVisitTab } from '@/lib/visit'
import { useProfileGate } from '@/components/profile-gate'
import { ActiveStayView } from '@/components/places/active-stay'
import { NotifyBanner } from '@/components/places/notify-banner'
import { PlaceCard, PlaceCardSkeleton } from '@/components/places/place-card'
import { ReservationShape, useCamera } from '@/components/places/reservation-shape'
import { ScanFooter } from '@/components/places/scan-footer'
import { ScanSheet } from '@/components/places/scan-sheet'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Panel } from '@/components/ninja/page/parts'
import { SignInSheet } from '@/components/sign-in-options'

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
  const t = useT()
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
  // Until the stays answer, cards of nothing: the places flashing up and
  // then giving way to the clock is worse than a moment of nothing
  if (settling) {
    return (
      <NinjaPage title={t('rooms')}>
        <div className='flex flex-col gap-4'>
          <PlaceCardSkeleton />
          <PlaceCardSkeleton />
        </div>
      </NinjaPage>
    )
  }
  // One visit, one shape: a place's card becomes the reservation in the
  // list itself, then the clock here, which takes the card over by its id
  // (placeCardId) while the rest of the list falls away
  const view = seat.kind === 'stay' ? 'stay' : 'list'
  return (
    <>
      <LayoutGroup>
        <AnimatePresence mode='popLayout' initial={false}>
          <motion.div
            key={view}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          >
            {seat.kind === 'stay' ? <ActiveStayView stay={seat.stay} /> : <PlacesList atTable={seat.kind === 'table'} />}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
      {scanSheet}
    </>
  )
}

/** The bookable places of the branch — the rooms and stations with a
 *  clock, and any table the owner opened to reservations — as big cards,
 *  one open at a time with the booking under it. Once one is held the
 *  reservation grows over them (ReservationShape): one hold is all anyone gets. */
function PlacesList({ atTable }: { atTable: boolean }) {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const hold = useMyHold()
  const features = useFeatures()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [openId, setOpenId] = useState<number | null>(null)
  // A hold arriving closes whichever card was open, whether or not its
  // form lived to say it was done (a live update can bring the hold before
  // the tick has had its beat, and the form goes with the card's face).
  // Else cancelling brought the form back inside a card that looked shut
  const [wasHeld, setWasHeld] = useState(hold != null)
  if ((hold != null) !== wasHeld) {
    setWasHeld(hold != null)
    if (hold) setOpenId(null)
  }
  const [signInOpen, setSignInOpen] = useState(false)
  const closeHold = useCallback(() => setOpenId(null), [])

  // Live RoomStatusChanged updates + 30s fallback poll (app parity)
  useRoomsGroup()
  const { data: places = [], isLoading } = useBookablePlaces()

  const reservationsEnabled =
    features.reservations && (branch?.isReservationsEnabled ?? true)
  const canReserve = auth.isAuthenticated && !hold && reservationsEnabled
  const freeCount = places.filter((p) => Number(p.status) === PLACE_AVAILABLE).length
  const allBusy = places.length > 0 && freeCount === 0

  const handleToggle = async (place: PlaceViewModel) => {
    if (openId === Number(place.id)) {
      setOpenId(null)
      return
    }
    if (!auth.isAuthenticated) {
      setSignInOpen(true)
      return
    }
    // One hold at a time (app parity; the backend enforces it too)
    if (hold) return
    if (!(await ensureProfileComplete())) return
    setOpenId(Number(place.id))
  }

  // One progress for the whole move between the places and the reservation:
  // the shape grows over the list and the list falls out of focus behind it
  const progress = useMotionValue(hold ? 1 : 0)
  const camera = useCamera(progress)
  // Held, the reservation fills the screen: the page goes back to its top and
  // stays there, so its title never folds into the bar in the brand's place
  const held = hold != null
  useEffect(() => {
    if (!held) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [held])
  const placeCard = useCallback(
    (placeId: number | string | undefined) => document.querySelector<HTMLElement>(`[data-place='${String(placeId)}']`),
    []
  )

  return (
    <NinjaPage
      title={t('rooms')}
      subtitle={!hold && !isLoading && places.length > 0 && reservationsEnabled ? t('bookFreeNow', { count: freeCount }) : undefined}
    >
      <motion.div style={camera} inert={hold ? true : undefined} aria-hidden={hold ? true : undefined}>
        <Rise className='flex flex-col gap-4'>
          {!reservationsEnabled && (
            <RiseItem>
              <Panel className='text-destructive flex items-center gap-3 p-4'>
                <span className='bg-destructive/10 grid size-10 shrink-0 place-items-center rounded-full'>
                  <Ban className='size-5' />
                </span>
                <span className='text-[15px] font-semibold'>{t('reservationsUnavailable')}</span>
              </Panel>
            </RiseItem>
          )}

          {allBusy && !hold && auth.isAuthenticated && (
            <RiseItem>
              <NotifyBanner />
            </RiseItem>
          )}

          {isLoading ? (
            <RiseItem className='flex flex-col gap-4'>
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
            </RiseItem>
          ) : (
            <div className='flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start'>
              {places.map((place) => (
                <RiseItem key={String(place.id)}>
                  <PlaceCard
                    place={place}
                    canReserve={canReserve}
                    open={openId === Number(place.id) && !hold}
                    onToggle={handleToggle}
                    // Booked, the form stays until the hold arrives and the tick grows out of it (ReservationShape)
                    onDone={(outcome) => outcome === 'failed' && closeHold()}
                  />
                </RiseItem>
              ))}
            </div>
          )}

          {/* Telling someone already at a table to scan a table is noise */}
          {!atTable && (
            <RiseItem>
              <ScanFooter />
            </RiseItem>
          )}
        </Rise>
      </motion.div>

      <ReservationShape hold={hold} progress={progress} placeCard={placeCard} />
      {profileGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </NinjaPage>
  )
}
