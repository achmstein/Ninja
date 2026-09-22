import { useState } from 'react'
import {
  Armchair,
  DoorOpen,
  Plus,
  Search,
  ShoppingBag,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import type { TicketSummary } from '@/api/sales/types.gen'
import type {
  PlaceViewModel,
  ReservationViewModel,
  StayViewModel,
} from '@/api/spaces/types.gen'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  elapsedSeconds,
  formatClock,
  isHolding,
  isRunning,
  isTimed,
  PLACE_HELD,
  PLACE_OUT_OF_SERVICE,
  PLACE_ROOM,
  PLACE_STATION,
  PLACE_TABLE,
  placeStatusDot,
} from '@/features/places/status'
import { useSecondsClock } from '@/features/places/use-places'
import { useFeatures } from '@/lib/brand'
import { useLocalized, useT } from '@/lib/i18n'
import { toNumber } from '@/lib/money'
import { cn } from '@/lib/utils'

type PlaceListProps = {
  places: PlaceViewModel[]
  stayForPlace: (
    placeId: number | string | undefined,
  ) => StayViewModel | undefined
  reservationForPlace: (
    placeId: number | string | undefined,
  ) => ReservationViewModel | undefined
  tickets: TicketSummary[]
  busy: boolean
  loading: boolean
  onNewTab: () => void
  onPick: (place: PlaceViewModel) => void
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

const kindIcon: Record<number, LucideIcon> = {
  [PLACE_ROOM]: DoorOpen,
  [PLACE_TABLE]: Armchair,
  [PLACE_STATION]: Trophy,
}

/** Whether a place already has a bill on the floor: a stay's bill names the
 *  stay, a table's bill names the place. */
export function hasBill(
  place: PlaceViewModel,
  tickets: TicketSummary[],
): boolean {
  const id = toNumber(place.id)
  return tickets.some((ticket) => toNumber(ticket.placeId) === id)
}

/**
 * Every place that has no bill yet, as a narrow column beside the bills so
 * opening one is a single tap. It stays a list, searchable, so forty tables
 * and twelve rooms cost a scroll or a couple of letters, never the screen.
 * A place with a clock opens its controls (start a walk-in, seat the
 * reservation that just arrived); a place without one opens a bill, unless
 * somebody reserved it and is on their way.
 */
export function PlaceList({
  places,
  stayForPlace,
  reservationForPlace,
  tickets,
  busy,
  loading,
  onNewTab,
  onPick,
}: PlaceListProps) {
  const t = useT()
  const features = useFeatures()
  const localized = useLocalized()
  const [term, setTerm] = useState('')
  const nowMs = useSecondsClock(true)

  const needle = term.trim().toLowerCase()
  const matches = (
    name: { en?: string | null; ar?: string | null } | null | undefined,
  ) =>
    !needle ||
    (name?.en ?? '').toLowerCase().includes(needle) ||
    (name?.ar ?? '').toLowerCase().includes(needle)

  // A place with a bill is among the bills already; one without is here, in
  // whatever state it is in
  const free = places.filter(
    (place) =>
      place.isActive !== false &&
      matches(place.name) &&
      !hasBill(place, tickets),
  )
  const groups = [
    { kind: PLACE_ROOM, label: t('rooms') },
    { kind: PLACE_TABLE, label: t('tables') },
    { kind: PLACE_STATION, label: t('stations') },
  ].map((group) => ({
    ...group,
    places: free.filter((p) => Number(p.kind ?? PLACE_ROOM) === group.kind),
  }))

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

      {loading && free.length === 0 && (
        <>
          <Heading>{t('rooms')}</Heading>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='flex h-12 w-full items-center gap-3 px-3'>
              {/* status dot + place name — a place row's shape */}
              <Skeleton className='size-2.5 rounded-full' />
              <Skeleton className='h-4 flex-1' />
            </div>
          ))}
        </>
      )}

      {groups.map(
        (group) =>
          group.places.length > 0 && (
            <div key={group.kind} className='contents'>
              <Heading>{group.label}</Heading>
              {group.places.map((place) => {
                const Icon = kindIcon[group.kind] ?? DoorOpen
                const timed = isTimed(place, features.timeBilling)
                const stay = timed ? stayForPlace(place.id) : undefined
                const reservation = reservationForPlace(place.id)
                const reservedNow = isHolding(reservation)
                const outOfService =
                  Number(place.status) === PLACE_OUT_OF_SERVICE
                // The dot already says free; text only when there is
                // something to add
                const detail = isRunning(stay)
                  ? formatClock(elapsedSeconds(stay, nowMs))
                  : reservedNow
                    ? reservation?.customerName || t('statusReserved')
                    : outOfService
                      ? t('underMaintenance')
                      : null
                return (
                  <button
                    key={String(place.id)}
                    type='button'
                    disabled={outOfService || busy}
                    onClick={() => onPick(place)}
                    className={rowClass}
                  >
                    <span
                      className={cn(
                        'size-2.5 shrink-0 rounded-full',
                        // A plain table's bill says whether it is taken;
                        // its dot only turns for a reservation
                        timed || Number(place.status) === PLACE_HELD
                          ? (placeStatusDot[Number(place.status ?? 0)] ??
                              'bg-muted')
                          : 'bg-green-500',
                      )}
                    />
                    <span className='min-w-0 flex-1 truncate font-medium'>
                      {localized(place.name)}
                    </span>
                    {detail && (
                      <span className='text-muted-foreground truncate text-sm'>
                        {detail}
                      </span>
                    )}
                    <Icon className='text-muted-foreground size-4 shrink-0' />
                  </button>
                )
              })}
            </div>
          ),
      )}

      {free.length === 0 && !loading && (
        <p className='text-muted-foreground py-6 text-center text-sm'>
          {needle ? t('noPlaceMatches') : t('everyPlaceHasABill')}
        </p>
      )}
    </div>
  )
}
