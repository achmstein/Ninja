import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Armchair,
  Clock,
  DoorOpen,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  X,
  ShoppingCart,
  IdCard,
  type LucideIcon,
} from 'lucide-react'
import {
  getOpenTicketsOptions,
  openTicketMutation,
} from '@/api/sales/@tanstack/react-query.gen'
import type { TicketSummary } from '@/api/sales/types.gen'
import type { PlaceViewModel, StayViewModel } from '@/api/spaces/types.gen'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PendingOrdersStrip } from '@/features/orders/pending-orders'
import { ServiceRequestsStrip } from '@/features/requests/service-requests-strip'
import { PlacePanel } from '@/features/places/place-panel'
import { StartStayDialog } from '@/features/places/start-stay-dialog'
import {
  PLACE_AVAILABLE,
  elapsedSeconds,
  expiresInSeconds,
  formatClock,
  isHolding,
  isRunning,
  isTimed,
} from '@/features/places/status'
import { usePlaces, useSecondsClock } from '@/features/places/use-places'
import { API_VERSION } from '@/lib/api-client'
import {
  pendingForTicket,
  usePendingOrders,
} from '@/features/orders/use-pending-orders'
import { useFeatures, useIsCloudKitchen } from '@/lib/brand'
import { useLocale, useLocalized, useT } from '@/lib/i18n'
import { useMoney, toNumber } from '@/lib/money'
import { TICKET_TYPE_TABLE } from '@/lib/ticket-types'
import {
  CustomerCard,
  type CardCustomer,
} from '@/features/customer/customer-card'
import { CustomerDialog } from '@/features/sale/customer-dialog'
import { NewTicketDialog } from './new-ticket-dialog'
import { PlaceList } from './place-list'
import { TimerReset } from 'lucide-react'

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
  stay,
  waiting,
  nowMs,
  onClick,
}: {
  ticket: TicketSummary
  stay: StayViewModel | undefined
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

  const active = isRunning(stay)

  return (
    <button
      type='button'
      onClick={onClick}
      className='bg-card hover:bg-accent/50 flex min-h-28 flex-col gap-2 rounded-xl border p-3 text-start'
    >
      <div className='flex items-start gap-2'>
        <Icon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
        {/* Two lines for a name, laid out in the name's own script so a long
            English name in an Arabic till is cut at its end, not its start */}
        <span
          dir='auto'
          className='line-clamp-2 min-w-0 flex-1 text-base font-semibold ltr:text-left rtl:text-right'
        >
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
          {formatClock(elapsedSeconds(stay, nowMs))}
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
  const locale = useLocale()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [newTabOpen, setNewTabOpen] = useState(false)
  const [findOpen, setFindOpen] = useState(false)
  const [cardFor, setCardFor] = useState<CardCustomer | null>(null)
  const [selectedPlaceId, setSelectedPlaceId] = useState<number | null>(null)
  // A free timed place has one thing to do: start the clock. It opens the
  // rate choice directly; the panel is for places with more to see
  const [startPlaceId, setStartPlaceId] = useState<number | null>(null)
  // A clock just started at this place: its bill is being opened by Sales
  // on the event, and the till goes there the moment it shows up
  const [startedPlaceId, setStartedPlaceId] = useState<number | null>(null)
  const [billSearch, setBillSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
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
  const features = useFeatures()
  // No tables to open or seat: the till is the open bills and the counter
  const cloudKitchen = useIsCloudKitchen()
  const [filter, setFilter] = useState<'all' | 'Room' | 'Table' | 'Counter'>(
    'all',
  )

  const { data: tickets = [], isLoading } = useQuery({
    ...getOpenTicketsOptions({ query: { 'api-version': API_VERSION } }),
    // Poll fallback in case the SignalR connection is silently dead; a
    // quick poll while a just-started stay's bill is on its way
    refetchInterval: startedPlaceId != null ? 600 : 20_000,
  })
  const {
    places,
    stays,
    reservations,
    stayForPlace,
    reservationForPlace,
    placeById,
    isLoading: placesLoading,
  } = usePlaces()
  const { pending } = usePendingOrders()

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

  useEffect(() => {
    if (startedPlaceId == null) return
    const bill = tickets.find(
      (ticket) =>
        toNumber(ticket.placeId) === startedPlaceId && ticket.sessionId != null,
    )
    if (bill) {
      setStartedPlaceId(null)
      toTicket(bill)
      return
    }
    // The bill never came (Sales down, event lost): stop the quick poll and
    // leave the cashier on the floor, where the place now shows as occupied
    const giveUp = setTimeout(() => setStartedPlaceId(null), 15_000)
    return () => clearTimeout(giveUp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedPlaceId, tickets])

  const stayForTicket = (ticket: TicketSummary) =>
    ticket.sessionId == null
      ? undefined
      : stays.find((s) => toNumber(s.id) === toNumber(ticket.sessionId))

  // Reservations are the one thing not yet a bill that the cashier must
  // not miss: somebody is on their way, or due later today
  const reserved = reservations
  const running = tickets.some((ticket) => isRunning(stayForTicket(ticket)))
  const nowMs = useSecondsClock(running || reserved.length > 0)
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, {
      hour: 'numeric',
      minute: '2-digit',
    })

  // Bills in the order of their places: rooms, then tables, then counter
  // tabs, each in place order, oldest first within a place
  const placeOrder = new Map(places.map((p, i) => [toNumber(p.id), i]))
  const typeRank = (type?: string) =>
    type === 'Room' ? 0 : type === 'Table' ? 1 : 2
  const placeRank = (ticket: TicketSummary) =>
    ticket.type === 'Counter'
      ? 0
      : (placeOrder.get(toNumber(ticket.placeId)) ?? places.length)
  const bills = [...tickets].sort(
    (a, b) =>
      typeRank(a.type) - typeRank(b.type) ||
      placeRank(a) - placeRank(b) ||
      new Date(a.openedAt ?? 0).getTime() - new Date(b.openedAt ?? 0).getTime(),
  )

  const counts = {
    all: bills.length,
    Room: bills.filter((b) => b.type === 'Room').length,
    Table: bills.filter((b) => b.type === 'Table').length,
    Counter: bills.filter((b) => b.type === 'Counter').length,
  }
  const billQuery = billSearch.trim().toLowerCase()
  const shownBills = bills
    .filter((b) => filter === 'all' || b.type === filter)
    .filter((b) => {
      if (!billQuery) return true
      const name = (localized(b.locationName) || b.label || '').toLowerCase()
      return (
        name.includes(billQuery) || String(toNumber(b.id)).includes(billQuery)
      )
    })
  const waitingIds = new Set(
    bills
      .filter((b) => pendingForTicket(pending, b).length > 0)
      .map((b) => toNumber(b.id)),
  )

  const selectedPlace = placeById(selectedPlaceId ?? undefined) ?? null
  const startPlace = placeById(startPlaceId ?? undefined) ?? null

  // A place with no clock opens a bill; one with a clock and nothing on it
  // starts the clock; one that is reserved or has a running clock opens
  // its panel
  const openBill = (place: PlaceViewModel) =>
    openTable.mutate({
      // A retry on café Wi-Fi must not become a second command
      headers: { 'x-requestid': crypto.randomUUID() },
      query: { 'api-version': API_VERSION },
      body: {
        type: TICKET_TYPE_TABLE,
        placeId: toNumber(place.id),
        placeName: place.name,
      },
    })
  const pickPlace = (place: PlaceViewModel) => {
    const id = toNumber(place.id)
    const reservedNow = isHolding(reservationForPlace(place.id))
    if (!isTimed(place, features.timeBilling) && !reservedNow) openBill(place)
    else if (
      Number(place.status) === PLACE_AVAILABLE &&
      !stayForPlace(place.id) &&
      !reservedNow
    )
      setStartPlaceId(id)
    else setSelectedPlaceId(id)
  }

  return (
    <div
      className={
        placesOpen && !cloudKitchen
          ? 'grid gap-6 p-4 max-sm:p-3 md:grid-cols-[minmax(220px,1fr)_minmax(0,2.6fr)]'
          : 'grid gap-6 p-4 max-sm:p-3'
      }
    >
      {/* Places with no bill yet — sticky, scrolling on its own, last on a
          phone where the bills matter more. Collapsed away when the cashier
          wants the full width; the header toggle brings it back. The scroll
          box clips anything outside its edges, so a hair of inner padding
          keeps the search box's focus ring whole. */}
      {!cloudKitchen && (
        <aside
          hidden={!placesOpen}
          className='order-2 flex flex-col gap-2 md:order-1 md:sticky md:top-20 md:-mx-1 md:max-h-[calc(100svh-6rem)] md:overflow-y-auto md:px-1'
        >
          <Heading>{t('openPlace')}</Heading>
          <PlaceList
            places={places}
            stayForPlace={stayForPlace}
            reservationForPlace={reservationForPlace}
            tickets={tickets}
            busy={openTable.isPending}
            onNewTab={() => setNewTabOpen(true)}
            loading={placesLoading}
            onPick={pickPlace}
          />
        </aside>
      )}

      <section className='order-1 flex min-w-0 flex-col gap-5 md:order-2'>
        {/* A phone puts the buttons on a row of their own under the title */}
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            {!cloudKitchen && (
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
            )}
            <h1 className='text-xl font-bold'>{t('openBills')}</h1>
          </div>
          <div className='flex flex-wrap gap-2 max-sm:w-full'>
            <Button
              size='lg'
              className='h-12 gap-2 px-5 text-base max-sm:flex-1'
              onClick={() => navigate({ to: '/sale' })}
            >
              <ShoppingCart className='size-5' />
              {t('newSale')}
            </Button>
            {/* The places column is where a named counter tab opens; with
                no places it opens from here */}
            {cloudKitchen && (
              <Button
                size='lg'
                variant='outline'
                className='h-12 gap-2 px-5 text-base max-sm:flex-1'
                onClick={() => setNewTabOpen(true)}
              >
                <Plus className='size-5' />
                {t('newTab')}
              </Button>
            )}
            <Button
              size='lg'
              variant='outline'
              className='size-12'
              aria-label={t('receipts')}
              onClick={() => navigate({ to: '/receipts' })}
            >
              <ReceiptText className='size-5' />
            </Button>
            {/* The customer who walked in only to pay their tab: search, then
                their card — no sale, no list of everyone */}
            <Button
              size='lg'
              variant='outline'
              className='size-12'
              aria-label={t('findCustomer')}
              title={t('findCustomer')}
              onClick={() => setFindOpen(true)}
            >
              <IdCard className='size-5' />
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

        {features.reservations && !cloudKitchen && reserved.length > 0 && (
          <div className='flex flex-col gap-2'>
            <Heading>{t('statusReserved')}</Heading>
            <div className='flex gap-3 overflow-x-auto pb-1'>
              {reserved.map((reservation) => {
                const place = placeById(reservation.placeId)
                const holding = isHolding(reservation)
                // On their way: the minutes left to arrive. Due later: when.
                const expiresIn = holding
                  ? expiresInSeconds(reservation, nowMs)
                  : null
                return (
                  <button
                    key={String(reservation.id)}
                    type='button'
                    onClick={() =>
                      setSelectedPlaceId(toNumber(reservation.placeId))
                    }
                    className='bg-card hover:bg-accent/50 flex w-[240px] max-w-[80vw] shrink-0 items-center gap-3 rounded-xl border p-3 text-start shadow-xs'
                  >
                    <div className='flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10'>
                      {/* The customer asked for the clock to start on arrival:
                          Confirm in the panel does both */}
                      {reservation.startOnConfirm ? (
                        <TimerReset className='size-5 text-amber-600 dark:text-amber-500' />
                      ) : (
                        <Clock className='size-5 text-amber-600 dark:text-amber-500' />
                      )}
                    </div>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-base font-semibold'>
                        {localized(place?.name ?? reservation.placeName)}
                      </span>
                      <span className='text-muted-foreground block truncate text-sm'>
                        {reservation.customerName || t('statusReserved')}
                        {reservation.partySize
                          ? ` · ${t('partyOf', { count: reservation.partySize })}`
                          : ''}
                      </span>
                    </span>
                    {expiresIn != null ? (
                      <span className='font-mono text-sm text-amber-600 tabular-nums shrink-0 dark:text-amber-500'>
                        {formatClock(expiresIn).slice(3)}
                      </span>
                    ) : reservation.for && !holding ? (
                      <span className='text-muted-foreground shrink-0 text-sm tabular-nums'>
                        {timeOf(reservation.for)}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {isLoading ? (
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,220px))]'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className='bg-card flex min-h-28 flex-col gap-2 rounded-xl border p-3'
              >
                {/* icon + name, a clock line, and the total — a bill card's shape */}
                <div className='flex items-center gap-2'>
                  <Skeleton className='size-4 rounded' />
                  <Skeleton className='h-4 flex-1' />
                </div>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='mt-auto h-6 w-20' />
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-1 py-20 text-center'>
            <p className='text-lg font-medium'>{t('noOpenBills')}</p>
          </div>
        ) : (
          <div className='flex flex-col gap-3'>
            <div className='flex flex-wrap items-center gap-2'>
              {(['all', 'Room', 'Table', 'Counter'] as const).map((key) => {
                if (key === 'Room' && !features.timeBilling) return null
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
              {bills.length > 6 &&
                (searchOpen ? (
                  <div className='relative w-full sm:w-56'>
                    <Search className='text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2' />
                    <Input
                      autoFocus
                      value={billSearch}
                      onChange={(e) => setBillSearch(e.target.value)}
                      onBlur={() => {
                        if (!billSearch.trim()) setSearchOpen(false)
                      }}
                      placeholder={t('searchBills')}
                      className='h-11 ps-9 pe-9'
                      autoComplete='off'
                    />
                    {billSearch && (
                      <button
                        type='button'
                        aria-label={t('clear')}
                        // Keep focus so clearing doesn't blur and collapse the box
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setBillSearch('')}
                        className='text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2'
                      >
                        <X className='size-4' />
                      </button>
                    )}
                  </div>
                ) : (
                  <Button
                    type='button'
                    size='icon'
                    variant='outline'
                    className='size-11 rounded-full'
                    aria-label={t('searchBills')}
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className='size-5' />
                  </Button>
                ))}
            </div>

            {/* Rounded cards cap at ~220px so a lone bill stays a normal card,
                not a full-width banner, and the row fills left to right */}
            <div className='grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,220px))]'>
              {shownBills.map((ticket) => (
                <BillCard
                  key={String(ticket.id)}
                  ticket={ticket}
                  stay={stayForTicket(ticket)}
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
      {/* Search, then the card: no sale, no list of everyone */}
      <CustomerDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        accountsOnly
        titleKey='findCustomer'
        onSelect={(picked) => {
          if (picked.id)
            setCardFor({
              id: picked.id,
              name: picked.name,
              phone: picked.phone,
            })
        }}
      />
      <CustomerCard
        customer={cardFor}
        onOpenChange={(open) => !open && setCardFor(null)}
      />
      <StartStayDialog
        place={startPlace}
        onOpenChange={(open) => {
          if (!open) setStartPlaceId(null)
        }}
        onStarted={() => {
          if (startPlaceId == null) return
          setStartedPlaceId(startPlaceId)
          setStartPlaceId(null)
        }}
        onBillOnly={() => {
          if (startPlace) openBill(startPlace)
          setStartPlaceId(null)
        }}
      />
      <PlacePanel
        place={selectedPlace}
        stay={selectedPlace ? stayForPlace(selectedPlace.id) : undefined}
        reservation={
          selectedPlace ? reservationForPlace(selectedPlace.id) : undefined
        }
        onOpenChange={(open) => {
          if (!open) setSelectedPlaceId(null)
        }}
        onStarted={(placeId) => {
          setSelectedPlaceId(null)
          setStartedPlaceId(placeId)
        }}
        onSeated={(place) => {
          // A plain table: the party sat down, and their bill opens
          setSelectedPlaceId(null)
          openBill(place)
        }}
      />
    </div>
  )
}
