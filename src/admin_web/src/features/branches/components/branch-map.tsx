import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search, X } from 'lucide-react'
import type { GeoJSONSource, Map as MapLibre } from 'maplibre-gl'
import {
  googleWebKey,
  useAddressSearch,
  type LatLng,
} from '@/lib/address-search'
import { useBrand } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import { circleRing } from '@/lib/maps'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { rtlTextUrl, STYLE } from './free-map'

/** Google's map, in its own chunk: fetched only when it may be drawn */
const BranchGoogleMap = lazy(() => import('./branch-google-map'))

/** Close enough to tell one building from the next */
const STREET_ZOOM = 16

/** Where the map opens for a branch not yet placed: the middle of the business's country */
const COUNTRY_CENTRES: Record<string, LatLng> = {
  EG: { lat: 30.0444, lng: 31.2357 },
  SA: { lat: 24.7136, lng: 46.6753 },
  AE: { lat: 25.2048, lng: 55.2708 },
}

/**
 * Where the branch is, put on a map rather than pasted: the owner moves the
 * map under a pin that stays in the middle, or names the street and the map
 * flies there. The delivery area is drawn round the pin, so the owner sees
 * which streets it reaches. Opened on asking, since a map costs a load and
 * most edits of a branch are not about where it is. `onPlace` hears each
 * point the owner puts it on.
 */
export function BranchMap({
  start,
  radiusKm,
  onPlace,
}: {
  start: LatLng | null
  radiusKm: number
  onPlace: (point: LatLng) => void
}) {
  const t = useT()
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  const [open, setOpen] = useState(false)
  const [to, setTo] = useState<LatLng | null>(null)
  const [googleFailed, setGoogleFailed] = useState(false)
  const country = brand?.locale.country ?? 'EG'
  const startAt = start ?? COUNTRY_CENTRES[country] ?? COUNTRY_CENTRES.EG
  const apiKey = googleFailed
    ? null
    : googleWebKey(brand?.maps, window.location.hostname)

  if (!open)
    return (
      <Button
        type='button'
        variant='outline'
        size='sm'
        onClick={() => setOpen(true)}
      >
        <MapPin />
        {start ? t('branchMovePinOnMap') : t('branchPinOnMap')}
      </Button>
    )

  const settle = (point: LatLng, byUser: boolean) => {
    if (byUser) onPlace(point)
  }

  return (
    <div className='flex flex-col gap-2'>
      {brand?.maps?.search && (
        <PlaceSearch
          near={start}
          language={language}
          onPick={(point) => {
            setTo(point)
            onPlace(point)
          }}
        />
      )}
      <div className='bg-muted relative h-56 overflow-hidden rounded-lg border'>
        {apiKey ? (
          <Suspense fallback={<Waiting />}>
            <BranchGoogleMap
              apiKey={apiKey}
              language={language}
              region={country}
              start={startAt}
              to={to}
              radiusKm={radiusKm}
              onSettle={settle}
              onFail={() => setGoogleFailed(true)}
            />
          </Suspense>
        ) : (
          <FreeMap
            start={startAt}
            to={to}
            radiusKm={radiusKm}
            onSettle={settle}
          />
        )}
      </div>
      <p className='text-muted-foreground text-xs'>
        {t('branchMovePin')}
        {radiusKm > 0 && <> {t('branchRadiusDrawn', { km: radiusKm })}</>}
      </p>
    </div>
  )
}

/** The pin that stays put while the map moves under it; its tip is the point */
export function CentrePin({ moving }: { moving: boolean }) {
  return (
    <div
      aria-hidden
      className='pointer-events-none absolute inset-0 grid place-items-center'
    >
      <div
        className={cn(
          '-mt-8 transition-transform duration-150',
          moving && '-translate-y-2'
        )}
      >
        <MapPin
          className='fill-primary text-primary-foreground size-8 drop-shadow-md'
          strokeWidth={1.5}
        />
      </div>
      <span
        className={cn(
          'absolute size-2 rounded-full bg-black/40 transition-opacity',
          moving ? 'opacity-30' : 'opacity-70'
        )}
      />
    </div>
  )
}

export function Waiting() {
  return (
    <div className='text-muted-foreground absolute inset-0 grid place-items-center'>
      <Loader2 className='size-5 animate-spin' />
    </div>
  )
}

/** The street named, with Google's suggestions from the business's own server */
function PlaceSearch({
  near,
  language,
  onPick,
}: {
  near: LatLng | null
  language: string
  onPick: (point: LatLng) => void
}) {
  const t = useT()
  const search = useAddressSearch({ near, language })
  const [picking, setPicking] = useState<string | null>(null)
  return (
    <div className='flex flex-col gap-1'>
      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2' />
        <Input
          value={search.text}
          onChange={(e) => search.setText(e.target.value)}
          placeholder={t('branchSearchAddress')}
          aria-label={t('branchSearchAddress')}
          className='ps-8 pe-9'
          maxLength={100}
          autoComplete='off'
          // Enter picks nothing here: it would submit the branch's form
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
        {search.searching ? (
          <Loader2 className='text-muted-foreground absolute end-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin' />
        ) : (
          search.text && (
            <button
              type='button'
              onClick={() => search.setText('')}
              className='text-muted-foreground absolute end-1 top-1/2 grid size-7 -translate-y-1/2 place-items-center'
              aria-label={t('clear')}
            >
              <X className='size-4' />
            </button>
          )
        )}
      </div>
      {search.suggestions.length > 0 && (
        <ul className='rounded-lg border' role='listbox'>
          {search.suggestions.map((s) => (
            <li key={s.placeId}>
              <button
                type='button'
                role='option'
                aria-selected={false}
                disabled={picking != null}
                onClick={async () => {
                  setPicking(s.placeId)
                  const place = await search.pick(s)
                  setPicking(null)
                  if (place) onPick({ lat: place.lat, lng: place.lng })
                  else toast.error(t('branchSearchFailed'))
                }}
                className='hover:bg-muted flex w-full items-center gap-2 px-3 py-2 text-start text-sm'
              >
                {picking === s.placeId ? (
                  <Loader2 className='text-muted-foreground size-4 shrink-0 animate-spin' />
                ) : (
                  <MapPin className='text-muted-foreground size-4 shrink-0' />
                )}
                <span className='flex min-w-0 flex-col'>
                  <span className='truncate font-medium'>{s.primaryText}</span>
                  {s.secondaryText && (
                    <span className='text-muted-foreground truncate text-xs'>
                      {s.secondaryText}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** OpenFreeMap's streets through MapLibre, the delivery area as a ring round the pin */
function FreeMap({
  start,
  to,
  radiusKm,
  onSettle,
}: {
  start: LatLng
  to: LatLng | null
  radiusKm: number
  onSettle: (point: LatLng, byUser: boolean) => void
}) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [moving, setMoving] = useState(false)
  const settle = useRef(onSettle)
  useEffect(() => {
    settle.current = onSettle
  }, [onSettle])
  const radius = useRef(radiusKm)
  useEffect(() => {
    radius.current = radiusKm
  }, [radiusKm])
  const startAt = useRef(start)
  const pending = useRef<LatLng | null>(null)

  useEffect(() => {
    let disposed = false
    Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
      .then(([{ default: maplibre }]) => {
        if (disposed || !box.current) return
        if (maplibre.getRTLTextPluginStatus() === 'unavailable')
          void maplibre.setRTLTextPlugin(rtlTextUrl, true).catch(() => {})
        const m = new maplibre.Map({
          container: box.current,
          style: STYLE,
          center: [startAt.current.lng, startAt.current.lat],
          zoom: STREET_ZOOM,
          attributionControl: { compact: true },
          pitchWithRotate: false,
          dragRotate: false,
        })
        m.touchZoomRotate.disableRotation()
        const ring = () => {
          const c = m.getCenter()
          return {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'Polygon' as const,
              coordinates: [
                circleRing({ lat: c.lat, lng: c.lng }, radius.current),
              ],
            },
          }
        }
        m.on('load', () => {
          setReady(true)
          m.addSource('delivery-area', { type: 'geojson', data: ring() })
          m.addLayer({
            id: 'delivery-area-fill',
            type: 'fill',
            source: 'delivery-area',
            paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.08 },
          })
          m.addLayer({
            id: 'delivery-area-line',
            type: 'line',
            source: 'delivery-area',
            paint: { 'line-color': '#2563eb', 'line-width': 1.5 },
          })
          if (pending.current) {
            m.flyTo({
              center: [pending.current.lng, pending.current.lat],
              zoom: STREET_ZOOM,
            })
            pending.current = null
          }
        })
        m.on('error', () => {
          if (!m.loaded() && !disposed) setFailed(true)
        })
        m.on('movestart', () => setMoving(true))
        m.on('move', () => {
          if (radius.current > 0)
            (
              m.getSource('delivery-area') as GeoJSONSource | undefined
            )?.setData(ring())
        })
        m.on('moveend', (e) => {
          setMoving(false)
          const c = m.getCenter()
          settle.current(
            { lat: c.lat, lng: c.lng },
            'originalEvent' in e && e.originalEvent != null
          )
        })
        map.current = m
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      map.current?.remove()
      map.current = null
      setReady(false)
    }
  }, [attempt])

  useEffect(() => {
    if (!to) return
    const m = map.current
    if (m && m.loaded())
      m.flyTo({ center: [to.lng, to.lat], zoom: STREET_ZOOM })
    else pending.current = to
  }, [to])

  return (
    <>
      <div ref={box} className='size-full' />
      {failed ? (
        <div
          className='text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm'
          role='alert'
        >
          {t('mapNotLoaded')}
          <button
            type='button'
            onClick={() => {
              setFailed(false)
              setAttempt((a) => a + 1)
            }}
            className='font-medium underline underline-offset-4'
          >
            {t('mapRetry')}
          </button>
        </div>
      ) : (
        !ready && <Waiting />
      )}
      <CentrePin moving={moving} />
    </>
  )
}
