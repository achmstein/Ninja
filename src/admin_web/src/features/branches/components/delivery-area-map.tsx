import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { googleWebKey } from '@/lib/address-search'
import { useBrand } from '@/lib/brand'
import { useLanguage, useT } from '@/lib/i18n'
import {
  areaStartingBox,
  circleRing,
  type DeliveryArea,
  type LatLng,
} from '@/lib/maps'
import { Button } from '@/components/ui/button'
import { Waiting } from './branch-map'
import { AREA_COLOUR, startAreaDraw, type AreaDraw } from './delivery-area-draw'
import { rtlTextUrl, STYLE } from './free-map'

/** Google's map, in its own chunk: fetched only when it may be drawn */
const DeliveryAreaGoogleMap = lazy(() => import('./delivery-area-google-map'))

/** Where the map opens when there is neither an area nor a radius to fit: a few streets round */
const NEIGHBOURHOOD_ZOOM = 13

export interface DeliveryAreaMapProps {
  /** Where the branch is: the area is drawn round it */
  centre: LatLng
  /** The radius, drawn faintly for reference; 0 for none */
  radiusKm: number
  /** The area as it was when the map opened */
  initial: DeliveryArea | null
  /** Each time the area settles; null once cleared */
  onChange: (area: DeliveryArea | null) => void
}

/**
 * The branch's delivery area drawn on the map, on Google's where the
 * platform has it on for the business, otherwise on the free one: the
 * owner clicks the corners round the streets the riders reach, then drags
 * them. The radius stays on the map faintly, for reference.
 */
export default function DeliveryAreaMap({
  centre,
  radiusKm,
  initial,
  onChange,
}: DeliveryAreaMapProps) {
  const t = useT()
  const brand = useBrand()
  const language = useLanguage((s) => s.language)
  const [googleFailed, setGoogleFailed] = useState(false)
  const draw = useRef<AreaDraw | null>(null)
  const [drawing, setDrawing] = useState(initial == null)
  const apiKey = googleFailed
    ? null
    : googleWebKey(brand?.maps, window.location.hostname)
  const change = (area: DeliveryArea | null) => {
    setDrawing(area == null)
    onChange(area)
  }
  const ready = (d: AreaDraw | null) => {
    draw.current = d
  }

  return (
    <div className='flex flex-col gap-2'>
      <div className='bg-muted relative h-64 overflow-hidden rounded-lg border'>
        {apiKey ? (
          <Suspense fallback={<Waiting />}>
            <DeliveryAreaGoogleMap
              apiKey={apiKey}
              language={language}
              region={brand?.locale.country ?? 'EG'}
              centre={centre}
              radiusKm={radiusKm}
              initial={initial}
              onChange={change}
              onReady={ready}
              onFail={() => setGoogleFailed(true)}
            />
          </Suspense>
        ) : (
          <FreeAreaMap
            centre={centre}
            radiusKm={radiusKm}
            initial={initial}
            onChange={change}
            onReady={ready}
          />
        )}
      </div>
      <div className='flex items-start justify-between gap-3'>
        <p className='text-muted-foreground text-xs'>
          {drawing ? t('deliveryAreaDrawHint') : t('deliveryAreaEditHint')}
          {radiusKm > 0 && <> {t('deliveryAreaRadiusFaint')}</>}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='shrink-0'
          disabled={drawing}
          onClick={() => draw.current?.clear()}
        >
          <Eraser />
          {t('deliveryAreaClear')}
        </Button>
      </div>
    </div>
  )
}

/** OpenFreeMap's streets through MapLibre, terra-draw drawing on them */
function FreeAreaMap({
  centre,
  radiusKm,
  initial,
  onChange,
  onReady,
}: DeliveryAreaMapProps & { onReady: (draw: AreaDraw | null) => void }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  // What the map opens with; later changes are the drawing's own
  const opening = useRef({ centre, radiusKm, initial })
  const change = useRef(onChange)
  useEffect(() => {
    change.current = onChange
  }, [onChange])
  const readyCallback = useRef(onReady)
  useEffect(() => {
    readyCallback.current = onReady
  }, [onReady])

  useEffect(() => {
    let disposed = false
    let draw: AreaDraw | null = null
    let remove: (() => void) | null = null
    const { centre, radiusKm, initial } = opening.current
    Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl.css'),
    ])
      .then(([{ default: maplibre }]) => {
        if (disposed || !box.current) return
        if (maplibre.getRTLTextPluginStatus() === 'unavailable')
          void maplibre.setRTLTextPlugin(rtlTextUrl, true).catch(() => {})
        const fit = areaStartingBox(centre, radiusKm, initial)
        const m = new maplibre.Map({
          container: box.current,
          style: STYLE,
          center: [centre.lng, centre.lat],
          zoom: NEIGHBOURHOOD_ZOOM,
          attributionControl: { compact: true },
          pitchWithRotate: false,
          dragRotate: false,
        })
        m.touchZoomRotate.disableRotation()
        remove = () => m.remove()
        m.on('load', () => {
          if (disposed) return
          setReady(true)
          if (fit) m.fitBounds(fit, { padding: 24, duration: 0 })
          // The radius, faintly, and the branch, under the drawing
          if (radiusKm > 0) {
            m.addSource('delivery-radius', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'Polygon',
                  coordinates: [circleRing(centre, radiusKm)],
                },
              },
            })
            m.addLayer({
              id: 'delivery-radius-line',
              type: 'line',
              source: 'delivery-radius',
              paint: {
                'line-color': AREA_COLOUR,
                'line-width': 1,
                'line-opacity': 0.45,
                'line-dasharray': [2, 2],
              },
            })
          }
          m.addSource('branch', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'Point',
                coordinates: [centre.lng, centre.lat],
              },
            },
          })
          m.addLayer({
            id: 'branch-point',
            type: 'circle',
            source: 'branch',
            paint: {
              'circle-radius': 6,
              'circle-color': AREA_COLOUR,
              'circle-stroke-color': '#ffffff',
              'circle-stroke-width': 2,
            },
          })
          draw = startAreaDraw(
            new TerraDrawMapLibreGLAdapter({ map: m }),
            initial,
            (area) => change.current(area)
          )
          readyCallback.current(draw)
        })
        m.on('error', () => {
          if (!m.loaded() && !disposed) setFailed(true)
        })
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })
    return () => {
      disposed = true
      draw?.stop()
      readyCallback.current(null)
      remove?.()
      setReady(false)
    }
  }, [attempt])

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
    </>
  )
}
