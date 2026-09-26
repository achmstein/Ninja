import { useCallback, useEffect, useState } from 'react'
import { LayoutGroup } from 'motion/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Ban } from 'lucide-react'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import { useSelectedBranch } from '@/lib/branch'
import { useRoomsGroup } from '@/lib/hub'
import { PLACE_AVAILABLE } from '@/lib/places'
import { useMyHold } from '@/lib/stays'
import { useAfterTickBeat } from '@/lib/tick-beat'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { useFeatures } from '@/lib/brand'
import { useT } from '@/lib/i18n'
import { useBookablePlaces, useVisit, useVisitTab } from '@/lib/visit'
import { useProfileGate } from '@/components/profile-gate'
import { StayBanner } from '@/components/places/stay-banner'
import { NotifyBanner } from '@/components/places/notify-banner'
import { PlaceCard, PlaceCardSkeleton } from '@/components/places/place-card'
import { Reservation } from '@/components/places/reservation'
import { ScanFooter } from '@/components/places/scan-footer'
import { ScanSheet } from '@/components/places/scan-sheet'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Panel } from '@/components/ninja/page/parts'
import { Recede } from '@/components/motion/recede'
import { useRecede } from '@/components/motion/use-recede'
import { SignInSheet } from '@/components/sign-in-options'

export const Route = createFileRoute('/places')({
  component: PlacesPage,
  // ?scan={placeId}: a timed place's code just opened; the tab answers it
  // with a sheet from the bottom instead of a page of its own
  validateSearch: (search: Record<string, unknown>): { scan?: number } => (Number(search.scan) > 0 ? { scan: Number(search.scan) } : {}),
})

/**
 * The second tab (docs/visit-tab.html): the places to book, always. Where
 * the customer is now (a running clock, a scanned table) is the dock's row
 * and its sheet; a running clock is also a slim card over the places, a tap
 * away from the same sheet. Where there is nothing to book the tab does not
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
  const scanSheet = scan ? <ScanSheet placeId={scan} onDone={() => navigate({ to: '/places', search: {}, replace: true })} /> : null

  if (!visible) return null
  // Until the stays answer, cards of nothing: whether the room's card sits over the places is not known yet
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
  return (
    <>
      <LayoutGroup>
        <PlacesList atTable={seat.kind === 'table'} stay={seat.kind === 'stay' ? seat.stay : undefined} />
      </LayoutGroup>
      {scanSheet}
    </>
  )
}

/** How long after a reservation opens its card's booking form closes, ms: the card is out of sight by then */
const FORM_CLOSES_MS = 900

/** The bookable places of the branch — the rooms and stations with a
 *  clock, and any table the owner opened to reservations — as big cards,
 *  one open at a time with the booking under it. Once one is held its card
 *  opens into the reservation (Reservation): one hold is all anyone gets. */
function PlacesList({ atTable, stay }: { atTable: boolean; stay?: StayViewModel }) {
  const t = useT()
  const auth = useAuth()
  const branch = useSelectedBranch()
  const hold = useMyHold()
  const features = useFeatures()
  const { ensureProfileComplete, profileGateDialog } = useProfileGate()

  const [openId, setOpenId] = useState<number | null>(null)
  // The reservation shown: the hold, held still while a tick (booking's or
  // cancelling's) has its beat. While it is open everything but its own
  // place's card steps back and the page stays put under it
  const opened = useAfterTickBeat(hold)
  const held = opened != null
  const heldId = opened ? String(opened.placeId) : null
  const titleShown = useRecede(held)
  useScrollLock(held)
  // The card it opened out of closes its booking form once it is out of sight
  useEffect(() => {
    if (!held) return
    const timer = window.setTimeout(() => setOpenId(null), FORM_CLOSES_MS)
    return () => window.clearTimeout(timer)
  }, [held])
  const [signInOpen, setSignInOpen] = useState(false)
  const closeHold = useCallback(() => setOpenId(null), [])

  // Live RoomStatusChanged updates + 30s fallback poll (app parity)
  useRoomsGroup()
  const { data: places = [], isLoading } = useBookablePlaces()

  const reservationsEnabled = features.reservations && (branch?.isReservationsEnabled ?? true)
  // One place at a time: a hold, or a clock running (the server refuses a second either way)
  const canReserve = auth.isAuthenticated && !hold && !stay && reservationsEnabled
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
    // One place at a time (app parity; the backend enforces it too)
    if (hold || stay) return
    if (!(await ensureProfileComplete())) return
    setOpenId(Number(place.id))
  }

  return (
    <NinjaPage
      title={t('rooms')}
      fade={titleShown}
      subtitle={!hold && !stay && !isLoading && places.length > 0 && reservationsEnabled ? t('bookFreeNow', { count: freeCount }) : undefined}
    >
      <div inert={opened ? true : undefined} aria-hidden={opened ? true : undefined}>
        <Rise className='flex flex-col gap-4'>
          {stay && (
            <RiseItem>
              <Recede gone={held}>
                <StayBanner stay={stay} />
              </Recede>
            </RiseItem>
          )}

          {!reservationsEnabled && (
            <RiseItem>
              <Recede gone={held}>
                <Panel className='text-destructive flex items-center gap-3 p-4'>
                  <span className='bg-destructive/10 grid size-10 shrink-0 place-items-center rounded-full'>
                    <Ban className='size-5' />
                  </span>
                  <span className='text-[15px] font-semibold'>{t('reservationsUnavailable')}</span>
                </Panel>
              </Recede>
            </RiseItem>
          )}

          {allBusy && !hold && auth.isAuthenticated && (
            <RiseItem>
              <Recede gone={held}>
                <NotifyBanner />
              </Recede>
            </RiseItem>
          )}

          {isLoading ? (
            <RiseItem className='flex flex-col gap-4'>
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
              <PlaceCardSkeleton />
            </RiseItem>
          ) : (
            <div className='flex flex-col gap-4'>
              {places.map((place) => (
                <RiseItem key={String(place.id)}>
                  <Recede gone={held && String(place.id) !== heldId}>
                    <PlaceCard
                      place={place}
                      canReserve={canReserve}
                      open={openId === Number(place.id)}
                      onToggle={handleToggle}
                      // Booked, the form stays until the hold opens the card into the reservation
                      onDone={(outcome) => outcome === 'failed' && closeHold()}
                      handedOver={String(place.id) === heldId}
                    />
                  </Recede>
                </RiseItem>
              ))}
            </div>
          )}

          {/* Telling someone already at a table to scan a table is noise */}
          {!atTable && (
            <RiseItem>
              <Recede gone={held}>
                <ScanFooter />
              </Recede>
            </RiseItem>
          )}
        </Rise>
      </div>

      <Reservation hold={opened} />
      {profileGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} />
    </NinjaPage>
  )
}

