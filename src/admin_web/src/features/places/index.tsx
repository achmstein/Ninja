import { useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { Gamepad2, History, MoreHorizontal, Plus, QrCode } from 'lucide-react'
import { type PlaceViewModel, type StayViewModel } from '@/api/spaces'
import { useLocalized, useT, type TranslationKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { Main } from '@/components/layout/main'
import { HoldDialog } from './components/hold-dialog'
import { PlaceDetailPanel } from './components/place-detail-panel'
import { PlaceDialog } from './components/place-dialog'
import { PlaceKindIcon } from './components/place-kind-icon'
import { StartHeldDialog } from './components/start-held-dialog'
import { WalkInDialog } from './components/walk-in-dialog'
import {
  isHeld,
  isRunning,
  PLACE_AVAILABLE,
  PLACE_OUT_OF_SERVICE,
  PLACE_PHYSICAL_AVAILABLE,
  PLACE_PHYSICAL_OUT_OF_SERVICE,
  placeKinds,
  placeStatusConfig,
  tariffLine,
} from './status'
import { usePendingOrders, usePlaces, useStayActions } from './use-places'

const route = getRouteApi('/_authenticated/places/')

const statusFilters: { value: string; key: TranslationKey }[] = [
  { value: 'all', key: 'allPlaces' },
  { value: '1', key: 'statusAvailable' },
  { value: '2', key: 'statusOccupied' },
  { value: '3', key: 'held' },
  { value: '4', key: 'outOfService' },
]

/** One-line summary under the place name: who is there, or its rates. */
function placeSubline(
  place: PlaceViewModel,
  stay: StayViewModel | undefined,
  t: (key: TranslationKey, params?: Record<string, string | number>) => string,
  localized: (
    text: { en?: string | null; ar?: string | null } | null | undefined
  ) => string
): string {
  if (isRunning(stay)) {
    const who = stay!.customerName || t('walkIn')
    const option = localized(stay!.currentOptionName)
    return option ? `${who} · ${option}` : who
  }
  if (isHeld(stay)) {
    return stay!.customerName
      ? t('heldFor', { name: stay!.customerName })
      : t('held')
  }
  if (Number(place.status) === PLACE_OUT_OF_SERVICE) return t('outOfService')
  return tariffLine(place, t, localized)
}

/**
 * Rooms, tables and stations as a master-detail split: the places grouped
 * by kind on the start side, the selected place's clock, orders and
 * history on the end side.
 */
export function PlacesManagement() {
  const t = useT()
  const localized = useLocalized()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const actions = useStayActions()

  const { places, stayFor, isLoading } = usePlaces()
  const { ordersAt } = usePendingOrders()

  const [status, setStatus] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [editPlace, setEditPlace] = useState<PlaceViewModel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlaceViewModel | null>(null)
  const [holdPlace, setHoldPlace] = useState<PlaceViewModel | null>(null)
  const [walkInPlace, setWalkInPlace] = useState<PlaceViewModel | null>(null)
  const [startHeld, setStartHeld] = useState<{
    stay: StayViewModel
    mode: 'start' | 'confirm'
  } | null>(null)

  const selectedPlace = places.find((p) => Number(p.id) === search.place)
  const select = (placeId: number | undefined) =>
    navigate({ search: (prev) => ({ ...prev, place: placeId }) })

  const visible = places.filter(
    (place) => status === 'all' || Number(place.status) === Number(status)
  )

  return (
    <>
      <Main fixed>
        <section className='relative flex h-full gap-6'>
          {/* Master: the places, grouped by kind */}
          <div className='flex w-full flex-col gap-2 sm:w-64 lg:w-80 2xl:w-96'>
            <div className='flex items-start justify-between py-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('placesNav')}
              </h1>
              <div className='flex items-center'>
                <Button
                  size='icon'
                  variant='ghost'
                  onClick={() => setAddOpen(true)}
                  aria-label={t('newPlace')}
                >
                  <Plus size={20} className='stroke-muted-foreground' />
                </Button>
                <Button size='icon' variant='ghost' asChild>
                  <Link to='/places/print' aria-label={t('printQrSheet')}>
                    <QrCode size={20} className='stroke-muted-foreground' />
                  </Link>
                </Button>
                <Button size='icon' variant='ghost' asChild>
                  <Link to='/places/history' aria-label={t('timeHistory')}>
                    <History size={20} className='stroke-muted-foreground' />
                  </Link>
                </Button>
              </div>
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger size='sm' className='w-full'>
                <SelectValue>
                  {t(
                    statusFilters.find((s) => s.value === status)?.key ??
                      'allPlaces'
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
              {isLoading ? (
                [...Array(6)].map((_, i) => (
                  <Skeleton key={i} className='mb-2 h-14 rounded-md' />
                ))
              ) : places.length === 0 ? (
                <EmptyState
                  compact
                  icon={Gamepad2}
                  title={t('noPlacesYet')}
                  action={
                    <Button variant='outline' onClick={() => setAddOpen(true)}>
                      <Plus className='me-2 h-4 w-4' />
                      {t('newPlace')}
                    </Button>
                  }
                />
              ) : (
                placeKinds.map(({ kind, key }) => {
                  const group = visible.filter(
                    (place) => Number(place.kind) === kind
                  )
                  if (group.length === 0) return null
                  return (
                    <div key={kind} className='mb-3'>
                      <h2 className='text-muted-foreground px-2 pb-1 text-xs font-semibold tracking-wide uppercase'>
                        {t(key)}
                      </h2>
                      {group.map((place) => {
                        const stay = stayFor(place.id)
                        const orders = ordersAt(place)
                        const placeStatus =
                          placeStatusConfig[Number(place.status ?? 0)] ??
                          placeStatusConfig[PLACE_AVAILABLE]
                        const outOfService =
                          Number(place.status) === PLACE_OUT_OF_SERVICE
                        const selected = Number(place.id) === search.place
                        const busy = stay != null
                        return (
                          <div
                            key={String(place.id)}
                            className={cn(
                              'hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-md py-1 ps-2 pe-1 text-sm',
                              selected && 'sm:bg-muted',
                              !place.isActive && 'opacity-60'
                            )}
                          >
                            <button
                              type='button'
                              className='flex min-w-0 flex-1 items-center gap-3 py-1.5 text-start'
                              onClick={() => select(Number(place.id))}
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${placeStatus.dotClass}`}
                              />
                              <div className='min-w-0 flex-1'>
                                <div className='flex items-center gap-2'>
                                  <span className='truncate font-medium'>
                                    {localized(place.name)}
                                  </span>
                                  {orders.length > 0 && (
                                    <Badge className='h-5 min-w-5 rounded-full px-1.5 tabular-nums'>
                                      {orders.length}
                                    </Badge>
                                  )}
                                </div>
                                <div className='text-muted-foreground truncate text-xs tabular-nums'>
                                  {placeSubline(place, stay, t, localized)}
                                </div>
                              </div>
                              <PlaceKindIcon
                                kind={kind}
                                className='text-muted-foreground size-4 shrink-0'
                              />
                            </button>

                            {/* Closed places keep their printed code but
                                stop taking orders and holds */}
                            <Switch
                              aria-label={t('acceptingCustomers')}
                              checked={Boolean(place.isActive)}
                              disabled={actions.isBusy}
                              onCheckedChange={(checked) =>
                                actions.setActive(Number(place.id), checked)
                              }
                            />

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size='icon'
                                  variant='ghost'
                                  className='size-7'
                                  aria-label={t('actions')}
                                >
                                  <MoreHorizontal className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuItem
                                  onClick={() => setEditPlace(place)}
                                >
                                  {t('edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={busy || actions.isBusy}
                                  onClick={() =>
                                    actions.setStatus(
                                      Number(place.id),
                                      outOfService
                                        ? PLACE_PHYSICAL_AVAILABLE
                                        : PLACE_PHYSICAL_OUT_OF_SERVICE
                                    )
                                  }
                                >
                                  {t(
                                    outOfService
                                      ? 'backInService'
                                      : 'outOfService'
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant='destructive'
                                  disabled={busy}
                                  onClick={() => setDeleteTarget(place)}
                                >
                                  {t('delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </ScrollArea>
          </div>

          {/* Detail */}
          {selectedPlace ? (
            <div
              className={cn(
                'bg-background absolute inset-0 start-full z-50 hidden w-full flex-1 flex-col border transition-all duration-200 sm:static sm:z-auto sm:flex sm:rounded-lg',
                // start-0 (NOT the nonexistent inset-s-0) pulls the panel
                // on-screen — on mobile it overlays the list full-screen
                'start-0 flex'
              )}
            >
              <PlaceDetailPanel
                key={String(selectedPlace.id)}
                place={selectedPlace}
                stay={stayFor(selectedPlace.id)}
                orders={ordersAt(selectedPlace)}
                onBack={() => select(undefined)}
                onHold={() => setHoldPlace(selectedPlace)}
                onWalkIn={() => setWalkInPlace(selectedPlace)}
                onStartHeld={(stay, mode) => setStartHeld({ stay, mode })}
              />
            </div>
          ) : (
            <div className='bg-card hidden w-full flex-1 flex-col justify-center rounded-lg border sm:flex'>
              <EmptyState icon={Gamepad2} title={t('selectPlace')} />
            </div>
          )}
        </section>
      </Main>

      <HoldDialog
        place={holdPlace}
        onOpenChange={(open) => {
          if (!open) setHoldPlace(null)
        }}
      />

      <WalkInDialog
        place={walkInPlace}
        onOpenChange={(open) => {
          if (!open) setWalkInPlace(null)
        }}
      />

      <StartHeldDialog
        stay={startHeld?.stay ?? null}
        mode={startHeld?.mode ?? 'start'}
        onOpenChange={(open) => {
          if (!open) setStartHeld(null)
        }}
      />

      {addOpen && (
        <PlaceDialog
          place={null}
          places={places}
          open
          onOpenChange={setAddOpen}
        />
      )}

      {editPlace && (
        <PlaceDialog
          place={editPlace}
          places={places}
          open
          onOpenChange={(open) => {
            if (!open) setEditPlace(null)
          }}
        />
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={t('deletePlaceQuestion')}
        desc={t('cannotBeUndone')}
        confirmText={t('delete')}
        destructive
        isLoading={actions.isBusy}
        handleConfirm={() => {
          if (!deleteTarget) return
          const id = Number(deleteTarget.id)
          actions.deletePlace(id, {
            onSuccess: () => {
              setDeleteTarget(null)
              // The selected place is gone, so drop back to the empty state
              if (search.place === id) select(undefined)
            },
          })
        }}
      />
    </>
  )
}
