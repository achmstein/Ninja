import { useCallback, useEffect, useState } from 'react'
import { LayoutGroup } from 'motion/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { CirclePause, UserRound } from 'lucide-react'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import { useBranchStore } from '@/stores/branch-store'
import { useRoomsGroup } from '@/lib/hub'
import { PLACE_AVAILABLE, PLACE_STATION, PLACE_TABLE } from '@/lib/places'
import { useMyHold } from '@/lib/stays'
import { useAfterTickBeat } from '@/lib/tick-beat'
import { useScrollLock } from '@/lib/use-scroll-lock'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { useBookablePlacesByBranch, useVisit, useVisitTab, type BranchPlaces } from '@/lib/visit'
import { useProfileGate } from '@/components/auth/profile-gate'
import { StayBanner } from '@/components/places/stay-banner'
import { YourRoomCard } from '@/components/places/your-room-card'
import { SectionLabel } from '@/components/ninja/page/parts'
import { NotifyBanner } from '@/components/places/notify-banner'
import { PlaceCard, PlaceCardSkeleton } from '@/components/places/place-card'
import { type PlacesStyle, usePlacesStyle } from '@/components/places/places-style'
import { Reservation } from '@/components/places/reservation'
import { ScanFooter } from '@/components/places/scan-footer'
import { ScanSheet } from '@/components/places/scan-sheet'
import { BranchDial } from '@/components/places/branch-dial'
import { NinjaPage, Rise, RiseItem } from '@/components/ninja/page/page'
import { Notice } from '@/components/ninja/page/notice'
import { Recede } from '@/components/motion/recede'
import { useRecede } from '@/components/motion/use-recede'
import { SignInSheet } from '@/components/auth/sign-in-options'
import { cn } from '@/lib/utils'
import { DirectionsLink, UseMyLocation } from '@/components/branch-switcher'
import { useAtBranch, useBranchesByDistance, useBranchSwitch } from '@/lib/use-branch-switch'
import type { TranslationKey } from '@/lib/i18n'

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
  const look = usePlacesStyle()

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
        <PlaceSkeletons look={look} count={look === 'cards' ? 2 : 4} />
      </NinjaPage>
    )
  }
  return (
    <>
      <LayoutGroup>
        <PlacesList atTable={seat.kind === 'table'} stay={seat.kind === 'stay' ? seat.stay : undefined} look={look} />
      </LayoutGroup>
      {scanSheet}
    </>
  )
}

/** How each layout spaces its places: big cards apart, rows close, tiles two a row */
const LIST_CLASS: Record<PlacesStyle, string> = {
  cards: 'flex flex-col gap-4',
  list: 'flex flex-col gap-2',
  grid: 'grid grid-cols-2 gap-3',
}

const KIND_HEADINGS: Record<number, TranslationKey> = {
  [PLACE_TABLE]: 'ninjaPlacesTables',
  [PLACE_STATION]: 'ninjaPlacesStations',
}

/**
 * The places by kind, in the order each kind first appears, for the list and
 * the grid: where a branch has rooms and tables both, a heading over each lets
 * the eye skip to its own. One kind, or the big cards, is one group with no heading.
 */
function groupByKind(places: PlaceViewModel[], look: PlacesStyle): { heading?: TranslationKey; places: PlaceViewModel[] }[] {
  const kinds = [...new Set(places.map((p) => Number(p.kind)))]
  if (look === 'cards' || kinds.length < 2) return [{ places }]
  return kinds.map((kind) => ({
    heading: KIND_HEADINGS[kind] ?? 'ninjaPlacesRooms',
    places: places.filter((p) => Number(p.kind) === kind),
  }))
}

function PlaceSkeletons({ look, count }: { look: PlacesStyle; count: number }) {
  return (
    <div className={LIST_CLASS[look]}>
      {Array.from({ length: count }, (_, i) => (
        <PlaceCardSkeleton key={i} look={look} />
      ))}
    </div>
  )
}

/** How long after a reservation opens its card's booking form closes, ms: the card is out of sight by then */
const FORM_CLOSES_MS = 900

/** The bookable places of the branch — the rooms and stations with a
 *  clock, and any table the owner opened to reservations — as big cards,
 *  one open at a time with the booking under it. Once one is held its card
 *  opens into the reservation (Reservation): one hold is all anyone gets. */
function PlacesList({ atTable, stay, look }: { atTable: boolean; stay?: StayViewModel; look: PlacesStyle }) {
  const t = useT()
  const localized = useLocalized()
  const auth = useAuth()
  const branchId = useBranchStore((s) => s.branchId)
  const atBranch = useAtBranch()
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
  const { groups, isLoading } = useBookablePlacesByBranch()
  // Every branch that takes bookings, each under its own name: the closest first once the customer's
  // position is known (asked for here, once a session, only where there are branches to measure)
  const multi = groups.length > 1
  const { sorted, location, anyPoint } = useBranchesByDistance(multi, groups.map((g) => g.branch))
  const ordered = sorted.flatMap(({ item, meters }) => {
    const group = groups.find((g) => g.branch === item)
    return group ? [{ ...group, meters }] : []
  })
  const places = ordered.flatMap((g) => g.places)
  // One branch at a time, chosen on the dial: the one the customer is at, else the nearest
  const [viewId, setViewId] = useState<number | null>(null)
  const viewed =
    ordered.find((g) => Number(g.branch.id) === viewId) ?? ordered.find((g) => Number(g.branch.id) === branchId) ?? ordered[0]
  const shown = multi ? (viewed ? [viewed] : []) : ordered
  // The selected branch's own places: the notify switch is the branch's, as is the room the customer is in
  const here = groups.find((g) => Number(g.branch.id) === branchId)?.places ?? []
  const { request: requestBranch, dialog: switchDialog } = useBranchSwitch()

  // Some branch takes bookings: the selected one, or another listed beside it
  const takesBookings = (group: BranchPlaces) => features.reservations && (group.branch.isReservationsEnabled ?? true)
  const reservationsEnabled = groups.length === 0 ? features.reservations : groups.some(takesBookings)
  // One place at a time: a hold, or a clock running (the server refuses a second either way). A guest's
  // free places answer a tap too: with the sign-in sheet, rather than a card that does nothing.
  // Another branch's places book only while the customer is at none (a bill, a scanned table)
  const canReserveAt = (group: BranchPlaces) =>
    !hold && !stay && takesBookings(group) && (Number(group.branch.id) === branchId || !atBranch)
  const freeCount = places.filter((p) => Number(p.status) === PLACE_AVAILABLE).length
  // The room the customer is in, when it is one of these places
  const mine = stay ? here.find((p) => String(p.id) === String(stay.placeId)) : undefined
  const allBusy = here.length > 0 && here.every((p) => Number(p.status) !== PLACE_AVAILABLE) && freeCount === 0

  const handleToggle = async (place: PlaceViewModel, placeBranchId: number) => {
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
    // Another branch's place: the app moves to that branch first (asking when the order has dishes), then
    // the booking opens as it would at home, against the branch it now names
    requestBranch(placeBranchId, () => setOpenId(Number(place.id)))
  }

  return (
    <NinjaPage
      title={t('rooms')}
      fade={titleShown}
      // In a room the heading says where; otherwise how many places are free
      subtitle={
        stay
          ? t('ninjaYoureIn', { name: localized(stay.placeName) })
          : !hold && !isLoading && places.length > 0 && reservationsEnabled
            ? t('bookFreeNow', { count: freeCount })
            : undefined
      }
    >
      <div inert={opened ? true : undefined} aria-hidden={opened ? true : undefined}>
        <Rise className='flex flex-col gap-4'>
          {/* In a room whose card is not on this list (another branch's): the slim card stands in for it */}
          {stay && !mine && (
            <RiseItem>
              <Recede gone={held}>
                <StayBanner stay={stay} />
              </Recede>
            </RiseItem>
          )}

          {/* Booking across branches: the dial, nearest first once the customer's position is known */}
          {multi && !isLoading && (
            <RiseItem>
              <Recede gone={held}>
                <div className='flex flex-col gap-2'>
                  <BranchDial
                    branches={ordered}
                    selectedId={viewed ? Number(viewed.branch.id) : null}
                    onSelect={setViewId}
                    panelId='branch-places'
                  />
                  {/* Under the dial: the customer's position on their word, and the way to the chosen branch */}
                  <div className='flex items-center justify-between gap-3'>
                    {anyPoint && !location.here ? <UseMyLocation location={location} /> : <span />}
                    {viewed && <DirectionsLink branch={viewed.branch} />}
                  </div>
                </div>
              </Recede>
            </RiseItem>
          )}

          {!reservationsEnabled && (
            <RiseItem>
              <Recede gone={held}>
                <Notice tone='paused' icon={CirclePause} title={t('reservationsPausedTitle')} />
              </Recede>
            </RiseItem>
          )}

          {/* A guest can look but not book: one quiet line with the way to an account, the places first */}
          {!auth.isAuthenticated && reservationsEnabled && (
            <RiseItem>
              <Recede gone={held}>
                <button
                  type='button'
                  onClick={() => setSignInOpen(true)}
                  className='text-primary inline-flex min-h-11 items-center gap-2 text-note font-semibold'
                >
                  <UserRound className='size-4' />
                  {t('bookSignInLine')}
                </button>
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
            <RiseItem>
              <PlaceSkeletons look={look} count={look === 'cards' ? 3 : 6} />
            </RiseItem>
          ) : (
            <div id='branch-places' role={multi ? 'tabpanel' : undefined} className='flex flex-col gap-4'>
              {/* In a room, that room first as the hero, the others after it under their label and quieter:
                  while the clock runs another place cannot be booked, so they are there to read */}
              {stay && mine && (
                <RiseItem>
                  <YourRoomCard stay={stay} place={mine} />
                </RiseItem>
              )}
              {stay && mine && places.length > 1 && (
                <RiseItem>
                  <SectionLabel>{t('ninjaOtherPlaces')}</SectionLabel>
                </RiseItem>
              )}
              {shown.map((branchGroup) => {
                const groupBranchId = Number(branchGroup.branch.id)
                const canReserve = canReserveAt(branchGroup)
                const others = branchGroup.places.filter((p) => p !== mine)
                // The dial above names the branch, how many are free and how far: its places follow straight on
                return (
                  <div key={String(branchGroup.branch.id)} className='flex flex-col gap-4'>
                    {groupByKind(others, look).map((group) => (
                      <div key={group.heading ?? 'all'} className={cn(LIST_CLASS[look], group.heading && 'mt-2 first:mt-0')}>
                        {group.heading && (
                          <RiseItem className={cn(look === 'grid' && 'col-span-2', stay && mine && 'opacity-60')}>
                            <Recede gone={held}>
                              <SectionLabel>{t(group.heading)}</SectionLabel>
                            </Recede>
                          </RiseItem>
                        )}
                        {group.places.map((place) => (
                          <RiseItem
                            key={String(place.id)}
                            className={cn(
                              stay && mine && 'opacity-60',
                              // An open tile takes the row, so the booking under it has the width to breathe
                              look === 'grid' && openId === Number(place.id) && 'col-span-2'
                            )}
                          >
                            <Recede gone={held && String(place.id) !== heldId}>
                              <PlaceCard
                                place={place}
                                look={look}
                                canReserve={canReserve}
                                open={openId === Number(place.id)}
                                onToggle={(p) => handleToggle(p, groupBranchId)}
                                // Booked, the form stays until the hold opens the card into the reservation
                                onDone={(outcome) => outcome === 'failed' && closeHold()}
                                handedOver={String(place.id) === heldId}
                              />
                            </Recede>
                          </RiseItem>
                        ))}
                      </div>
                    ))}
                  </div>
                )
              })}
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
      {switchDialog}
      {profileGateDialog}
      <SignInSheet open={signInOpen} onOpenChange={setSignInOpen} title={t('bookSignInTitle')} description={t('bookSignInBody')} />
    </NinjaPage>
  )
}
