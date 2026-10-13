import { useEffect, useRef, useState } from 'react'
import {
  APILoadingStatus,
  APIProvider,
  Circle,
  Map,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { Loader2 } from 'lucide-react'
import type { LatLng } from '@/lib/address-search'
import { CentrePin } from './branch-map'

/** Close enough to tell one building from the next, as the free map opens */
const STREET_ZOOM = 16

/**
 * The branch's map drawn by Google, with the delivery area as a circle
 * round the pin: loaded only when the platform has the web's Google map on
 * for the business and this host is on the key. If Google refuses (the
 * day's quota spent, the key not valid here), `onFail` puts the free map back.
 */
export default function BranchGoogleMap({
  apiKey,
  language,
  region,
  ...props
}: {
  apiKey: string
  language: string
  region: string
  start: LatLng
  to: LatLng | null
  radiusKm: number
  onSettle: (point: LatLng, byUser: boolean) => void
  onFail: () => void
}) {
  return (
    <APIProvider
      apiKey={apiKey}
      language={language}
      region={region}
      onError={props.onFail}
    >
      <PinnedMap {...props} />
    </APIProvider>
  )
}

function PinnedMap({
  start,
  to,
  radiusKm,
  onSettle,
  onFail,
}: {
  start: LatLng
  to: LatLng | null
  radiusKm: number
  onSettle: (point: LatLng, byUser: boolean) => void
  onFail: () => void
}) {
  const status = useApiLoadingStatus()
  const map = useMap()
  const [moving, setMoving] = useState(false)
  const [centre, setCentre] = useState(start)
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
    if (
      status === APILoadingStatus.FAILED ||
      status === APILoadingStatus.AUTH_FAILURE
    )
      fail.current()
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
        gestureHandling='greedy'
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        headingInteractionEnabled={false}
        tiltInteractionEnabled={false}
        onDragstart={() => {
          dragged.current = true
          setMoving(true)
        }}
        onCameraChanged={(e) => {
          setMoving(true)
          setCentre(e.detail.center)
        }}
        onIdle={(e) => {
          setMoving(false)
          const c = e.map.getCenter()
          if (c) settle.current({ lat: c.lat(), lng: c.lng() }, dragged.current)
          dragged.current = false
        }}
      >
        {radiusKm > 0 && (
          <Circle
            center={centre}
            radius={radiusKm * 1000}
            clickable={false}
            strokeColor='#2563eb'
            strokeWeight={1.5}
            fillColor='#2563eb'
            fillOpacity={0.08}
          />
        )}
      </Map>
      {status !== APILoadingStatus.LOADED && (
        <div className='text-muted-foreground absolute inset-0 grid place-items-center'>
          <Loader2 className='size-5 animate-spin' />
        </div>
      )}
      <CentrePin moving={moving} />
    </>
  )
}
