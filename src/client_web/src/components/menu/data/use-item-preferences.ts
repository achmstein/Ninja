import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import type { UserItemPreferenceDto } from '@/api/catalog'
import { getUserPreferencesOptions } from '@/api/catalog/@tanstack/react-query.gen'

const none = new Map<number, UserItemPreferenceDto>()
// Kept out of the hook so the map is built once per answer, not once per item per render
const byItem = (list: UserItemPreferenceDto[]) => new Map(list.map((p) => [Number(p.catalogItemId), p]))

/**
 * The signed-in customer's saved way of each item (what they chose the last
 * time they ordered it), by item id: one request for the whole menu, shared
 * by every item. A guest has none.
 */
export function useItemPreferences(): Map<number, UserItemPreferenceDto> {
  const auth = useAuth()
  const { data } = useQuery({
    ...getUserPreferencesOptions(),
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
    retry: false,
    select: byItem,
  })
  return data ?? none
}

/** One item's saved way, or undefined */
export function useItemPreference(itemId: number): UserItemPreferenceDto | undefined {
  return useItemPreferences().get(itemId)
}
