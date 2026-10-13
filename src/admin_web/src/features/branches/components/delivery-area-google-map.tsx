import { useEffect, useRef } from 'react'
import {
  APILoadingStatus,
  APIProvider,
  Circle,
  Map,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps'
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter'
import { areaStartingBox } from '@/lib/maps'
import { Waiting } from './branch-map'
import { AREA_COLOUR, startAreaDraw, type AreaDraw } from './delivery-area-draw'
import type { DeliveryAreaMapProps } from './delivery-area-map'

type Props = DeliveryAreaMapProps & {
  onReady: (draw: AreaDraw | null) => void
  onFail: () => void
}

/**
 * The delivery area drawn on Google's map, through terra-draw's Google
 * adapter: loaded only where the platform has the web's Google map on for
 * the business and this host is on the key. If Google refuses, `onFail`
 * puts the free map back.
 */
export default function DeliveryAreaGoogleMap({
  apiKey,
  language,
  region,
  ...props
}: Props & { apiKey: string; language: string; region: string }) {
  return (
    <APIProvider
      apiKey={apiKey}
      language={language}
      region={region}
      onError={props.onFail}
    >
      <AreaMap {...props} />
    </APIProvider>
  )
}

function AreaMap({
  centre,
  radiusKm,
  initial,
  onChange,
  onReady,
  onFail,
}: Props) {
  const status = useApiLoadingStatus()
  const map = useMap()
  // What the map opens with; later changes are the drawing's own
  const opening = useRef({ centre, radiusKm, initial })
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  }, [onChange])
  const ready = useRef(onReady)
  useEffect(() => {
    ready.current = onReady
  }, [onReady])
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
    if (!map) return
    const { centre, radiusKm, initial } = opening.current
    const fit = areaStartingBox(centre, radiusKm, initial)
    if (fit) {
      const [[west, south], [east, north]] = fit
      map.fitBounds({ west, south, east, north }, 24)
    }
    let draw: AreaDraw | null = null
    // The adapter draws through an overlay, which needs the map's projection
    const start = () => {
      if (draw || !map.getProjection()) return
      draw = startAreaDraw(
        new TerraDrawGoogleMapsAdapter({ lib: google.maps, map }),
        initial,
        (area) => change.current(area)
      )
      ready.current(draw)
    }
    const listener = map.addListener('projection_changed', start)
    start()
    return () => {
      listener.remove()
      draw?.stop()
      ready.current(null)
    }
  }, [map])

  return (
    <>
      <Map
        className='size-full'
        defaultCenter={centre}
        defaultZoom={13}
        gestureHandling='greedy'
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        disableDoubleClickZoom
        headingInteractionEnabled={false}
        tiltInteractionEnabled={false}
      >
        {/* The radius, faintly, for reference; and the branch */}
        {radiusKm > 0 && (
          <Circle
            center={centre}
            radius={radiusKm * 1000}
            clickable={false}
            strokeColor={AREA_COLOUR}
            strokeOpacity={0.45}
            strokeWeight={1}
            fillColor={AREA_COLOUR}
            fillOpacity={0.03}
          />
        )}
        <Circle
          center={centre}
          radius={30}
          clickable={false}
          strokeColor='#ffffff'
          strokeWeight={2}
          fillColor={AREA_COLOUR}
          fillOpacity={1}
        />
      </Map>
      {status !== APILoadingStatus.LOADED && <Waiting />}
    </>
  )
}
