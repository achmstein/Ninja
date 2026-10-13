import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPlace, type PlaceSuggestion } from '@/api/tenant'
import { autocompletePlacesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useDebounced } from '@/lib/use-debounced'

/**
 * Address search for a phoned-in delivery, kept cheap as the customer app's
 * is: Google is asked through the business's own server, only once three
 * letters stand still for 350 ms, and every search carries one session token
 * until a place is picked, so its keystrokes are billed as that one pick.
 */

/** The fewest letters searched for, as the server has it */
const MIN_SEARCH = 3

function searchable(text: string): string | null {
  const q = text.trim().replace(/\s+/g, ' ')
  return q.length >= MIN_SEARCH ? q : null
}

function newSearchSession(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // A till served over plain http on the shop's network: random enough to keep two searches apart
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`
}

export type PickedPlace = { lat: number; lng: number; address: string | null }

/**
 * The search behind one field: what has been typed, Google's suggestions for
 * it (leaning toward the business's first branch, the server's default), and
 * `pick`, which asks where one is and starts a new session.
 */
export function useAddressSearch({ language, enabled = true }: { language: string; enabled?: boolean }) {
  const [text, setText] = useState('')
  const [session, setSession] = useState<string | null>(null)
  const debounced = useDebounced(text, 350)
  // Cleared counts at once: a search just picked is not asked again while the pause runs out
  const q = searchable(text) == null ? null : searchable(debounced)
  if (q && session == null) setSession(newSearchSession())

  const suggestions = useQuery({
    ...autocompletePlacesOptions({ query: { q: q ?? '', session: session ?? undefined, lang: language } }),
    enabled: enabled && q != null && session != null,
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
