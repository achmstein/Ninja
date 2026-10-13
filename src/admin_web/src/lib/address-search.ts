import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlace, type PlaceSuggestion } from '@/api/tenant'
import { autocompletePlacesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import {
  nearParam,
  newSearchSession,
  SEARCH_DEBOUNCE_MS,
  searchable,
  type LatLng,
} from './maps'

export { googleWebKey, type LatLng } from './maps'

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
export function useAddressSearch({
  near,
  language,
  enabled = true,
}: {
  near?: LatLng | null
  language: string
  enabled?: boolean
}) {
  const [text, setText] = useState('')
  const [session, setSession] = useState<string | null>(null)
  const debounced = useDebounced(text)
  // Cleared (or cut short) counts at once: a search just picked is not asked again while the pause runs out
  const q = searchable(text) == null ? null : searchable(debounced)
  // A search opens its session with its first call
  if (q && session == null) setSession(newSearchSession())

  const suggestions = useQuery({
    ...autocompletePlacesOptions({
      query: {
        q: q ?? '',
        session: session ?? undefined,
        near: nearParam(near),
        lang: language,
      },
    }),
    enabled: enabled && q != null && session != null,
    // The same street typed again in the session costs nothing, here or on the server
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  })

  const pick = async (
    suggestion: PlaceSuggestion
  ): Promise<PickedPlace | null> => {
    const token = session ?? undefined
    // The pick closes the session; the next search opens another
    setSession(null)
    try {
      const { data } = await getPlace({
        path: { placeId: suggestion.placeId },
        query: { session: token, lang: language },
        throwOnError: true,
      })
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
