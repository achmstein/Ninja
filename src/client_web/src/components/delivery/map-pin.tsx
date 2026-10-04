import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin as PinIcon } from 'lucide-react'
import type { Map as MapLibre } from 'maplibre-gl'
// MapLibre's right-to-left shaping, served from this app (no third-party script host)
import rtlTextUrl from '@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url'
import type { LatLng } from '@/lib/geo'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Free street tiles, no key: OpenFreeMap's style, the same streets the riders' maps show */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/** Close enough to tell one building from the next */
const STREET_ZOOM = 17

/**
 * A map the customer moves under a pin that stays in the middle, the way
 * delivery apps ask "where exactly": wherever the map comes to rest is the
 * point. MapLibre is loaded only here, when a sheet that needs it opens.
 * `to` moves the map (the customer's location found, a saved address picked);
 * one asked for before the map is up is flown to once it is. `onSettle` says
 * where it came to rest, and whether the customer moved it themselves.
 */
export function MapPicker({
  start,
  to,
  onSettle,
  className,
}: {
  start: LatLng
  /** A new point to fly to; each new object moves the map once */
  to?: LatLng | null
  onSettle: (point: LatLng, byUser: boolean) => void
  className?: string
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
  // Where to fly once the map is up, when `to` came first
  const pending = useRef<LatLng | null>(null)
  const startAt = useRef(start)

  useEffect(() => {
    let disposed = false
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([{ default: maplibre }]) => {
        if (disposed || !box.current) return
        // Arabic street names joined and right to left, not letter by letter backwards
        if (maplibre.getRTLTextPluginStatus() === 'unavailable') void maplibre.setRTLTextPlugin(rtlTextUrl, true).catch(() => {})
        const m = new maplibre.Map({
          container: box.current,
          style: STYLE,
          center: [startAt.current.lng, startAt.current.lat],
          zoom: STREET_ZOOM,
          attributionControl: { compact: true },
          // One finger moves it: the page under the sheet does not scroll through
          cooperativeGestures: false,
          pitchWithRotate: false,
          dragRotate: false,
        })
        m.touchZoomRotate.disableRotation()
        m.on('load', () => {
          setReady(true)
          if (pending.current) {
            m.flyTo({ center: [pending.current.lng, pending.current.lat], zoom: STREET_ZOOM, speed: 1.6 })
            pending.current = null
          }
        })
        // The style or its tiles never came: say so, with a way to try again
        m.on('error', (e) => {
          if (!m.loaded() && !disposed) setFailed(true)
          void e
        })
        m.on('movestart', () => setMoving(true))
        m.on('moveend', (e) => {
          setMoving(false)
          const c = m.getCenter()
          settle.current({ lat: c.lat, lng: c.lng }, 'originalEvent' in e && e.originalEvent != null)
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
    if (m && m.loaded()) m.flyTo({ center: [to.lng, to.lat], zoom: STREET_ZOOM, speed: 1.6 })
    else pending.current = to
  }, [to])

  return (
    <div className={cn('bg-muted relative overflow-hidden rounded-[1.25rem]', className)}>
      {/* Sized by width and height, not inset: MapLibre's stylesheet makes its container position: relative */}
      <div ref={box} className='size-full' />
      {failed ? (
        <div className='text-muted-foreground absolute inset-0 flex flex-col items-center justify-center gap-2 text-caption' role='alert'>
          {t('mapNotLoaded')}
          <button
            type='button'
            onClick={() => {
              setFailed(false)
              setAttempt((a) => a + 1)
            }}
            className='min-h-11 font-semibold underline underline-offset-4'
          >
            {t('mapRetry')}
          </button>
        </div>
      ) : (
        !ready && (
          <div className='text-muted-foreground absolute inset-0 grid place-items-center'>
            <Loader2 className='size-5 animate-spin' />
          </div>
        )
      )}
      {/* The pin stays put; its tip is the point. It lifts while the map moves under it */}
      <div aria-hidden className='pointer-events-none absolute inset-0 grid place-items-center'>
        <div className={cn('-mt-9 flex flex-col items-center transition-transform duration-150', moving && '-translate-y-2')}>
          <PinIcon className='fill-primary text-primary-foreground size-9 drop-shadow-md' strokeWidth={1.5} />
        </div>
        <span className={cn('absolute size-2 rounded-full bg-black/40 transition-opacity', moving ? 'opacity-30' : 'opacity-70')} />
      </div>
    </div>
  )
}
