import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { APILoadingStatus, APIProvider, Map, useApiLoadingStatus, useMap } from '@vis.gl/react-google-maps'
import type { LatLng } from '@/lib/geo'
import { CentrePin } from './map-pin'

/** Close enough to tell one building from the next, as the free map opens */
const STREET_ZOOM = 17

/**
 * The same map under a fixed pin, drawn by Google: loaded only when the
 * platform has the web's Google map on and this host is on the key, and
 * only when a sheet that needs it opens (each load of it is billed). If
 * Google refuses (the day's quota spent, the key not valid here), `onFail`
 * puts the free map back in its place.
 */
export default function GoogleMapPicker({
  apiKey,
  language,
  region,
  start,
  to,
  onSettle,
  onFail,
}: {
  apiKey: string
  language: string
  region: string
  start: LatLng
  to?: LatLng | null
  onSettle: (point: LatLng, byUser: boolean) => void
  onFail: () => void
}) {
  return (
    <APIProvider apiKey={apiKey} language={language} region={region} onError={onFail}>
      <PinnedMap start={start} to={to} onSettle={onSettle} onFail={onFail} />
    </APIProvider>
  )
}

function PinnedMap({
  start,
  to,
  onSettle,
  onFail,
}: {
  start: LatLng
  to?: LatLng | null
  onSettle: (point: LatLng, byUser: boolean) => void
  onFail: () => void
}) {
  const status = useApiLoadingStatus()
  const map = useMap()
  const [moving, setMoving] = useState(false)
  // A drag since the map last came to rest: the customer moved it, not a fly
  const dragged = useRef(false)
  const settle = useRef(onSettle)
  useEffect(() => {
    settle.current = onSettle
  }, [onSettle])
  const fail = useRef(onFail)
  useEffect(() => {
    fail.current = onFail
  }, [onFail])

  useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) fail.current()
  }, [status])

  useEffect(() => {
    if (!to || !map) return
    map.panTo(to)
    map.setZoom(STREET_ZOOM)
  }, [to, map])

  return (
    <>
      <Map
        className='size-full'
        defaultCenter={start}
        defaultZoom={STREET_ZOOM}
        // One finger moves it, as the free map does; nothing on it to tap
        gestureHandling='greedy'
        disableDefaultUI
        clickableIcons={false}
        keyboardShortcuts={false}
        headingInteractionEnabled={false}
        tiltInteractionEnabled={false}
        onDragstart={() => {
          dragged.current = true
          setMoving(true)
        }}
        onCameraChanged={() => setMoving(true)}
        onIdle={(e) => {
          setMoving(false)
          const c = e.map.getCenter()
          if (c) settle.current({ lat: c.lat(), lng: c.lng() }, dragged.current)
          dragged.current = false
        }}
      />
      {status !== APILoadingStatus.LOADED && (
        <div className='text-muted-foreground absolute inset-0 grid place-items-center'>
          <Loader2 className='size-5 animate-spin' />
        </div>
      )}
      <CentrePin moving={moving} />
    </>
  )
}
