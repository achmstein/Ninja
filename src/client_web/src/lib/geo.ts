import { useCallback, useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useT } from '@/lib/i18n'
import { toast } from '@/lib/toast'

/** A point on the map, in degrees */
export type LatLng = { lat: number; lng: number }

type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'

type GeoState = {
  status: GeoStatus
  /** The last fix, kept for the session: asked once, it is not asked for again on every page */
  here: LatLng | null
  /** Asked on its own once this session: whatever the answer, the app does not ask again unbidden */
  asked: boolean
  set: (next: Partial<Pick<GeoState, 'status' | 'here' | 'asked'>>) => void
}

const useGeo = create<GeoState>()(
  persist(
    (set) => ({
      status: 'idle',
      here: null,
      asked: false,
      set: (next) => set(next),
    }),
    {
      name: 'ninja-geo',
      // This tab's session only; where storage is blocked (a private window, a preview) the access throws and the store keeps to memory
      storage: createJSONStorage(() => window.sessionStorage),
      // A fix and the fact of having asked outlive a reload; a "locating" caught mid-way does not
      partialize: (s) => ({ here: s.here, asked: s.asked, status: s.status === 'locating' ? 'idle' : s.status }),
    }
  )
)

// Browsers give the position only to a secure page: over plain http (a phone on the LAN's address) the call is refused without a prompt
const supported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator && window.isSecureContext

/** One request for the device's position; the store learns the answer */
function requestFix(precise = false) {
  const { set } = useGeo.getState()
  if (!supported()) {
    set({ status: 'unavailable', asked: true })
    return
  }
  set({ status: 'locating', asked: true })
  navigator.geolocation.getCurrentPosition(
    (pos) => set({ status: 'ok', here: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
    // A precise ask that fails keeps the coarse fix there was
    (err) => set({ status: err.code === err.PERMISSION_DENIED ? 'denied' : useGeo.getState().here ? 'ok' : 'unavailable' }),
    precise
      ? // A door for a rider: the GPS, fresh, given time to lock
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
      : // A café a street away needs no GPS lock: a coarse fix, a recent one if there is, and soon
        { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 }
  )
}

/** Whether the site may already read the position (granted), must not ask (denied), or would ask (prompt) */
async function permission(): Promise<PermissionState | null> {
  try {
    const result = await navigator.permissions?.query({ name: 'geolocation' })
    return result?.state ?? null
  } catch {
    return null
  }
}

/**
 * What the browser would do if asked for the position: give it (granted), refuse it without a word
 * (denied), or ask (prompt); null while unknown or where the browser cannot say. Follows a change
 * the customer makes in the browser's settings. 'unsupported' where no position can be had at all.
 */
export function useLocationPermission(): PermissionState | 'unsupported' | null {
  const [state, setState] = useState<PermissionState | 'unsupported' | null>(() => (supported() ? null : 'unsupported'))
  useEffect(() => {
    if (!supported()) return
    let status: PermissionStatus | undefined
    let cancelled = false
    const follow = () => status && setState(status.state)
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return
        status = s
        follow()
        s.addEventListener('change', follow)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      status?.removeEventListener('change', follow)
    }
  }, [])
  return state
}

/**
 * Where the customer is, on demand. Nothing asks on launch: a page that
 * needs it passes `ask` once it is on screen with something to measure,
 * and the browser asks then, once a session; a `quiet` page (the branches,
 * booking, the pickup branch) only reads a position the browser already
 * gives, and leaves the asking to the customer's own button. A no,
 * or a phone that cannot tell, is taken quietly; `locate` is the customer's
 * own "Use my location", for later. A refusal the browser remembers is not
 * asked again, by the app or by the button, which says so instead.
 *
 * `precise` is for putting a pin on a door (a delivery address): the page
 * asks for the GPS's own fix each time it opens, whatever was asked before
 * in the session, the coarse fix standing in until it comes; and the button
 * stays, to come back to where the customer is after moving the map away.
 */
export function useMyLocation(
  ask: boolean,
  {
    precise = false,
    quiet = false,
  }: {
    precise?: boolean
    /** Take the position only where the browser already gives it: never a prompt the customer did not ask for */
    quiet?: boolean
  } = {}
): {
  here: LatLng | null
  locating: boolean
  /** The customer could still give a fix (a better one, when precise): the page offers "Use my location" */
  canLocate: boolean
  locate: () => void
} {
  const t = useT()
  const { status, here, asked } = useGeo()
  // A precise page asks once each time it opens, not once a session
  const askedHere = useRef(false)

  useEffect(() => {
    if (!ask || !supported()) return
    if (precise ? askedHere.current : asked || here) return
    askedHere.current = true
    let cancelled = false
    let answered = false
    permission().then((state) => {
      if (cancelled || (!precise && useGeo.getState().asked)) return
      answered = true
      // Refused before, for good: take the answer without asking
      if (state === 'denied') useGeo.getState().set({ status: 'denied', asked: true })
      // Quiet: given already, or not at all (it stays for "Use my location")
      else if (quiet && state !== 'granted') askedHere.current = false
      else requestFix(precise)
    })
    return () => {
      cancelled = true
      // Torn down before it asked (strict mode's double mount): the next run asks
      if (!answered) askedHere.current = false
    }
  }, [ask, asked, here, precise, quiet])

  const locate = useCallback(() => {
    permission().then((state) => {
      if (state === 'denied') {
        useGeo.getState().set({ status: 'denied', asked: true })
        toast.info(t('locationOff'))
        return
      }
      requestFix(precise)
    })
  }, [t, precise])

  // A precise page keeps the button (its spinner while the GPS locks); otherwise it is offered only while there is no fix
  const canLocate = supported() && (precise || (!here && status !== 'locating'))
  return { here, locating: status === 'locating', canLocate, locate }
}

/** The branch's point, when the owner gave it one */
export function pointOf(place: { latitude?: number | string | null; longitude?: number | string | null } | null | undefined): LatLng | null {
  if (place?.latitude == null || place.longitude == null || place.latitude === '' || place.longitude === '') return null
  const lat = Number(place.latitude)
  const lng = Number(place.longitude)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** Metres between two points over the Earth's surface (haversine) */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** A distance as people say it: "800 m" to the nearest ten under a kilometre, "1.2 km" to one place under ten, "14 km" beyond */
export function distanceParts(meters: number): { value: string; unit: 'm' | 'km' } {
  if (meters < 950) return { value: String(Math.max(10, Math.round(meters / 10) * 10)), unit: 'm' }
  const tenths = Math.round(meters / 100) / 10
  return { value: tenths < 10 ? String(tenths) : String(Math.round(meters / 1000)), unit: 'km' }
}

/** The distance in the customer's language ("1.2 km", "1.2 كم") */
export function useDistance() {
  const t = useT()
  return (meters: number) => {
    const { value, unit } = distanceParts(meters)
    return t(unit === 'km' ? 'distanceKm' : 'distanceM', { value })
  }
}

/** Google Maps' way there from wherever the customer is */
export function directionsUrl(point: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`
}

/**
 * Things with a place, closest first when the customer's position is
 * known and the thing has a point; those without one after them, in the
 * order given (the caller's own: the last used, then the owner's).
 */
export function byDistance<T>(items: T[], here: LatLng | null, pointFor: (item: T) => LatLng | null): { item: T; meters: number | null }[] {
  const measured = items.map((item, index) => {
    const point = pointFor(item)
    return { item, index, meters: here && point ? distanceMeters(here, point) : null }
  })
  return measured
    .sort((a, b) => {
      if (a.meters != null && b.meters != null) return a.meters - b.meters
      if (a.meters != null) return -1
      if (b.meters != null) return 1
      return a.index - b.index
    })
    .map(({ item, meters }) => ({ item, meters }))
}
