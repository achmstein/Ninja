import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin as PinIcon } from 'lucide-react'
import type { Map as MapLibre } from 'maplibre-gl'
import type { LatLng } from '@/lib/geo'
import { cn } from '@/lib/utils'

/** Free street tiles, no key: OpenFreeMap's style, the same streets the riders' maps show */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'

/** Close enough to tell one building from the next */
const STREET_ZOOM = 17

/**
 * A map the customer moves under a pin that stays in the middle, the way
 * delivery apps ask "where exactly": wherever the map comes to rest is the
 * point. MapLibre is loaded only here, when a sheet that needs it opens.
 * `to` moves the map (the customer's location found, a saved address picked).
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
  onSettle: (point: LatLng) => void
  className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MapLibre | null>(null)
  const [ready, setReady] = useState(false)
  const [moving, setMoving] = useState(false)
  const settle = useRef(onSettle)
  useEffect(() => {
    settle.current = onSettle
  }, [onSettle])

  useEffect(() => {
    let disposed = false
    void Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([{ default: maplibre }]) => {
      if (disposed || !box.current) return
      const m = new maplibre.Map({
        container: box.current,
        style: STYLE,
        center: [start.lng, start.lat],
        zoom: STREET_ZOOM,
        attributionControl: { compact: true },
        // One finger moves it: the page under the sheet does not scroll through
        cooperativeGestures: false,
        pitchWithRotate: false,
        dragRotate: false,
      })
      m.touchZoomRotate.disableRotation()
      m.on('load', () => setReady(true))
      m.on('movestart', () => setMoving(true))
      m.on('moveend', () => {
        setMoving(false)
        const c = m.getCenter()
        settle.current({ lat: c.lat, lng: c.lng })
      })
      map.current = m
    })
    return () => {
      disposed = true
      map.current?.remove()
      map.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- made once; `to` moves it after
  }, [])

  useEffect(() => {
    if (to && map.current) map.current.flyTo({ center: [to.lng, to.lat], zoom: STREET_ZOOM, speed: 1.6 })
  }, [to])

  return (
    <div className={cn('bg-muted relative overflow-hidden rounded-[1.25rem]', className)}>
      <div ref={box} className='absolute inset-0' />
      {!ready && (
        <div className='text-muted-foreground absolute inset-0 grid place-items-center'>
          <Loader2 className='size-5 animate-spin' />
        </div>
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
