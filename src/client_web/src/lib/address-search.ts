import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlace, type PlaceSuggestion, type TenantMaps } from '@/api/tenant'
import { autocompletePlacesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import type { LatLng } from '@/lib/geo'

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
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // An old browser, or a page not served securely: random enough to keep two searches apart
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

/** "lat,lng", to five places (about a metre): where the suggestions lean */
export function nearParam(point: LatLng | null | undefined): string | undefined {
  return point ? `${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : undefined
}

/**
 * The browser key, when this page may draw Google's map: the platform has
 * the web map on and the key lists this host's domain (Google refuses the
 * key anywhere else, and the map would only show its error). Otherwise null,
 * and the free map stays.
 */
export function googleWebKey(maps: TenantMaps | null | undefined, hostname: string): string | null {
  if (!maps?.webKey) return null
  const host = hostname.toLowerCase()
  return maps.webDomains.some((d) => {
    const domain = d.trim().toLowerCase()
    return domain.length > 0 && (host === domain || host.endsWith(`.${domain}`))
  })
    ? maps.webKey
    : null
}

/** What `text` reads once it has stood still for `ms` */
export function useDebounced<T>(value: T, ms = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return settled
}

export type PickedPlace = LatLng & { address: string | null }

/**
 * The search behind one field: what has been typed, Google's suggestions
 * for it, and `pick`, which asks where one is and starts a new session.
 */
export function useAddressSearch({ near, language, enabled = true }: { near?: LatLng | null; language: string; enabled?: boolean }) {
  const [text, setText] = useState('')
  const [session, setSession] = useState<string | null>(null)
  const debounced = useDebounced(text)
  // Cleared (or cut short) counts at once: a search just picked is not asked again while the pause runs out
  const q = searchable(text) == null ? null : searchable(debounced)
  // A search opens its session with its first call
  if (q && session == null) setSession(newSearchSession())

  const suggestions = useQuery({
    ...autocompletePlacesOptions({ query: { q: q ?? '', session: session ?? undefined, near: nearParam(near), lang: language } }),
    enabled: enabled && q != null && session != null,
    // The same street typed again in the session costs nothing, here or on the server
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  })

  const pick = async (suggestion: PlaceSuggestion): Promise<PickedPlace | null> => {
    const token = session ?? undefined
    // The pick closes the session; the next search opens another
    setSession(null)
    try {
      const { data } = await getPlace({ path: { placeId: suggestion.placeId }, query: { session: token, lang: language }, throwOnError: true })
      const lat = Number(data.lat)
      const lng = Number(data.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      setText('')
      return { lat, lng, address: data.address ?? null }
    } catch {
      return null
    }
  }

  return {
    text,
    setText,
    suggestions: q != null ? (suggestions.data ?? []) : [],
    searching: q != null && suggestions.isFetching,
    pick,
  }
}
