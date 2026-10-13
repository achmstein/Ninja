import type { TenantMaps } from '@/api/tenant'

/** A point on the map, in degrees */
export type LatLng = { lat: number; lng: number }

/**
 * Address search, kept cheap: Google is asked through the business's own
 * server (never from here, with no key here), only once the customer has
 * typed three letters and paused, and every search carries one session token
 * until a place is picked, so its keystrokes are billed as that one pick.
 */

/** The fewest letters searched for, as the server has it */
export const MIN_SEARCH = 3

/** How long the typing pauses before the server is asked */
export const SEARCH_DEBOUNCE_MS = 350

/** What is sent, or null while it is too short to be worth a call */
export function searchable(text: string): string | null {
  const q = text.trim().replace(/\s+/g, ' ')
  return q.length >= MIN_SEARCH ? q : null
}

/** A new session's token: a UUID, which Google takes as is */
export function newSearchSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    return crypto.randomUUID()
  // An old browser, or a page not served securely: random enough to keep two searches apart
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

/** "lat,lng", to five places (about a metre): where the suggestions lean */
export function nearParam(
  point: LatLng | null | undefined
): string | undefined {
  return point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : undefined
}

/**
 * The browser key, when this page may draw Google's map: the platform has
 * the web map on and the key lists this host's domain (Google refuses the
 * key anywhere else, and the map would only show its error). Otherwise null,
 * and the free map stays.
 */
export function googleWebKey(
  maps: TenantMaps | null | undefined,
  hostname: string
): string | null {
  if (!maps?.webKey) return null
  const host = hostname.toLowerCase()
  return maps.webDomains.some((d) => {
    const domain = d.trim().toLowerCase()
    return domain.length > 0 && (host === domain || host.endsWith(`.${domain}`))
  })
    ? maps.webKey
    : null
}

/** The Earth's mean radius, in kilometres */
const EARTH_KM = 6371.0088

/**
 * The ring of points `radiusKm` from `centre`, closed (the last point is the
 * first), as [lng, lat] the way GeoJSON and MapLibre take them: how far a
 * branch delivers, drawn on the free map.
 */
export function circleRing(
  centre: LatLng,
  radiusKm: number,
  steps = 64
): [number, number][] {
  const d = radiusKm / EARTH_KM
  const lat = (centre.lat * Math.PI) / 180
  const lng = (centre.lng * Math.PI) / 180
  const ring: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const bearing = ((i % steps) / steps) * 2 * Math.PI
    const lat2 = Math.asin(
      Math.sin(lat) * Math.cos(d) +
        Math.cos(lat) * Math.sin(d) * Math.cos(bearing)
    )
    const lng2 =
      lng +
      Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat),
        Math.cos(d) - Math.sin(lat) * Math.sin(lat2)
      )
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI])
  }
  return ring
}

/** "lat,lng" to six places (a few centimetres), as the branch's location is saved and read back */
export function locationText(point: LatLng): string {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`
}

/** The point typed or pasted as plain coordinates ("30.0444, 31.2357"); a link is the server's to read */
export function pointOfText(text: string): LatLng | null {
  const m = text
    .trim()
    .match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null
}

/**
 * A delivery area drawn on the map, as the owner left it: its corners in
 * order, the ring closing from the last back to the first. The server holds
 * it to the same rules as {@link areaProblem}; these are here so the owner is
 * told before saving.
 */
export type DeliveryArea = LatLng[]

/** The fewest corners an area has: a triangle */
export const MIN_AREA_POINTS = 3

/** The most, as the server takes them */
export const MAX_AREA_POINTS = 200

/** How far from the branch any corner may be, in kilometres */
export const MAX_AREA_KM = 50

/** The great-circle distance between two points, in kilometres */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng

/** The corners in order, a repeated one (the closing point included) dropped */
function corners(points: DeliveryArea): DeliveryArea {
  const out: DeliveryArea = []
  for (const p of points)
    if (out.length === 0 || !samePoint(out[out.length - 1], p)) out.push(p)
  if (out.length > 1 && samePoint(out[0], out[out.length - 1])) out.pop()
  return out
}

/** The area as the server sends it ([lat, lng] pairs), or null for none */
export function areaOf(
  raw: ReadonlyArray<ReadonlyArray<number | string>> | null | undefined
): DeliveryArea | null {
  if (!raw || raw.length === 0) return null
  const points = raw
    .filter((p) => p.length === 2)
    .map((p) => ({ lat: Number(p[0]), lng: Number(p[1]) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  const ring = corners(points)
  return ring.length >= MIN_AREA_POINTS ? ring : null
}

/** The area as the server takes it: [lat, lng] pairs to six places; empty for none */
export function areaToApi(points: DeliveryArea | null): number[][] {
  if (!points) return []
  const round = (n: number) => Math.round(n * 1e6) / 1e6
  return corners(points).map((p) => [round(p.lat), round(p.lng)])
}

/** The area as GeoJSON draws it: [lng, lat], closed */
export function areaRing(points: DeliveryArea): [number, number][] {
  const ring = corners(points).map((p) => [p.lng, p.lat] as [number, number])
  return ring.length > 0 ? [...ring, ring[0]] : ring
}

/** The corners of a GeoJSON ring ([lng, lat], closed or not) */
export function areaOfRing(
  ring: ReadonlyArray<ReadonlyArray<number>>
): DeliveryArea {
  return corners(ring.map((c) => ({ lat: c[1], lng: c[0] })))
}

/** The box round the area, as [[west, south], [east, north]] */
export function areaBounds(
  points: DeliveryArea
): [[number, number], [number, number]] {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ]
}

/** Which way r turns from p to q: 0 on one line */
function turn(p: LatLng, q: LatLng, r: LatLng): number {
  const v =
    (q.lat - p.lat) * (r.lng - q.lng) - (q.lng - p.lng) * (r.lat - q.lat)
  return Math.abs(v) < 1e-15 ? 0 : v > 0 ? 1 : -1
}

/** q lies within the box of p and r (on the segment, when the three are on one line) */
const within = (p: LatLng, q: LatLng, r: LatLng) =>
  q.lat <= Math.max(p.lat, r.lat) &&
  q.lat >= Math.min(p.lat, r.lat) &&
  q.lng <= Math.max(p.lng, r.lng) &&
  q.lng >= Math.min(p.lng, r.lng)

function segmentsMeet(p1: LatLng, q1: LatLng, p2: LatLng, q2: LatLng) {
  const o1 = turn(p1, q1, p2)
  const o2 = turn(p1, q1, q2)
  const o3 = turn(p2, q2, p1)
  const o4 = turn(p2, q2, q1)
  if (o1 !== o2 && o3 !== o4) return true
  return (
    (o1 === 0 && within(p1, p2, q1)) ||
    (o2 === 0 && within(p1, q2, q1)) ||
    (o3 === 0 && within(p2, p1, q2)) ||
    (o4 === 0 && within(p2, q1, q2))
  )
}

/** Whether two edges that are not neighbours meet, or one folds back along the next */
export function crossesItself(points: DeliveryArea): boolean {
  const ring = corners(points)
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const a1 = ring[i]
    const a2 = ring[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      if ((j + 1) % n === i || (i + 1) % n === j) continue
      if (segmentsMeet(a1, a2, ring[j], ring[(j + 1) % n])) return true
    }
    const next = ring[(i + 2) % n]
    if (turn(a1, a2, next) === 0 && !within(a1, a2, next)) return true
  }
  return false
}

export type AreaProblem = 'tooFew' | 'tooMany' | 'crosses' | 'tooFar'

/** Why the server would refuse this area round a branch at `centre`, or null */
export function areaProblem(
  points: DeliveryArea,
  centre: LatLng
): AreaProblem | null {
  const ring = corners(points)
  if (ring.length < MIN_AREA_POINTS) return 'tooFew'
  if (ring.length > MAX_AREA_POINTS) return 'tooMany'
  if (ring.some((p) => distanceKm(centre, p) > MAX_AREA_KM)) return 'tooFar'
  const flat = ring.every((p) => turn(ring[0], ring[1], p) === 0)
  if (flat || crossesItself(ring)) return 'crosses'
  return null
}

/**
 * What a map of the delivery area opens onto: the area drawn, else the
 * radius round the branch, else null (a few streets round the branch).
 */
export function areaStartingBox(
  centre: LatLng,
  radiusKm: number,
  area: DeliveryArea | null
): [[number, number], [number, number]] | null {
  if (area && area.length >= MIN_AREA_POINTS) return areaBounds(area)
  if (radiusKm > 0)
    return areaBounds(
      circleRing(centre, radiusKm, 16).map(([lng, lat]) => ({ lat, lng }))
    )
  return null
}
