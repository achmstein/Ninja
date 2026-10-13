import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateNotSelfIntersecting,
  type GeoJSONStoreFeatures,
} from 'terra-draw'
import { areaOfRing, areaRing, type DeliveryArea } from '@/lib/maps'

/** The drawing's colour, the same blue the radius is drawn in */
export const AREA_COLOUR = '#2563eb'

type Adapter = ConstructorParameters<typeof TerraDraw>[0]['adapter']
type Validation = NonNullable<
  ConstructorParameters<typeof TerraDrawPolygonMode>[0]
>['validation']

/** What the map's buttons do to the drawing */
export interface AreaDraw {
  /** Takes the area away and starts drawing a new one */
  clear: () => void
  stop: () => void
}

/** A ring that crosses itself is refused as it is closed, and as a corner is dragged */
const notCrossing =
  (always: boolean): Validation =>
  (feature, { updateType }) =>
    always || String(updateType) !== 'provisional'
      ? ValidateNotSelfIntersecting(feature)
      : { valid: true }

/**
 * One area drawn on either map through terra-draw: corners clicked one after
 * another until the first is clicked again; then its corners dragged, a
 * midpoint dragged to add one, a corner right-clicked to take it away.
 * `onChange` hears the area each time it settles, null once it is cleared.
 */
export function startAreaDraw(
  adapter: Adapter,
  initial: DeliveryArea | null,
  onChange: (area: DeliveryArea | null) => void
): AreaDraw {
  const draw = new TerraDraw({
    adapter,
    modes: [
      new TerraDrawPolygonMode({
        validation: notCrossing(false),
        styles: {
          fillColor: AREA_COLOUR,
          fillOpacity: 0.15,
          outlineColor: AREA_COLOUR,
          outlineWidth: 2,
          closingPointColor: '#ffffff',
          closingPointOutlineColor: AREA_COLOUR,
          closingPointWidth: 6,
          closingPointOutlineWidth: 2,
        },
      }),
      new TerraDrawSelectMode({
        // The one area stays chosen: clicking off it does not let it go
        allowManualDeselection: false,
        flags: {
          polygon: {
            feature: {
              draggable: false,
              validation: notCrossing(true),
              coordinates: {
                draggable: true,
                midpoints: true,
                deletable: true,
              },
            },
          },
        },
        styles: {
          selectedPolygonColor: AREA_COLOUR,
          selectedPolygonFillOpacity: 0.15,
          selectedPolygonOutlineColor: AREA_COLOUR,
          selectedPolygonOutlineWidth: 2,
          selectionPointColor: '#ffffff',
          selectionPointOutlineColor: AREA_COLOUR,
          selectionPointWidth: 6,
          selectionPointOutlineWidth: 2,
          midPointColor: AREA_COLOUR,
          midPointOutlineColor: '#ffffff',
          midPointWidth: 4,
          midPointOutlineWidth: 1,
        },
      }),
    ],
  })

  const drawn = (): GeoJSONStoreFeatures | undefined =>
    draw
      .getSnapshot()
      .find(
        (f) => f.geometry.type === 'Polygon' && !f.properties.currentlyDrawing
      )

  const editing = (id: string | number) => {
    draw.setMode('select')
    draw.selectFeature(id)
  }

  const report = () => {
    const feature = drawn()
    if (!feature || feature.geometry.type !== 'Polygon') return onChange(null)
    const ring = feature.geometry.coordinates[0] ?? []
    onChange(ring.length > 0 ? areaOfRing(ring) : null)
  }

  draw.on('ready', () => {
    if (initial && initial.length >= 3) {
      const [added] = draw.addFeatures([
        {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates: [areaRing(initial)] },
          properties: { mode: 'polygon' },
        },
      ])
      if (added?.valid && added.id != null) return editing(added.id)
    }
    draw.setMode('polygon')
  })

  // Closed: one area is enough, so it goes straight to having its corners moved
  draw.on('finish', (id, context) => {
    if (context.mode === 'polygon' && context.action === 'draw') editing(id)
    report()
  })
  draw.on('change', (_ids, type) => {
    if (type === 'delete') report()
  })

  draw.start()

  return {
    clear: () => {
      draw.clear()
      draw.setMode('polygon')
      onChange(null)
    },
    stop: () => draw.stop(),
  }
}
