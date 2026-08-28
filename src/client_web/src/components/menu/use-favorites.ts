import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import {
  addFavoriteMutation,
  getUserFavoritesOptions,
  getUserFavoritesQueryKey,
  removeFavoriteMutation,
} from '@/api/catalog/@tanstack/react-query.gen'

// Server-backed favorites with optimistic toggling; anonymous visitors get
// an empty set and no toggle.
export function useFavorites() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  const { data: favoriteIds = [] } = useQuery({
    ...getUserFavoritesOptions(),
    enabled: auth.isAuthenticated,
  })
  const favorites = new Set(favoriteIds.map(Number))

  const queryKey = getUserFavoritesQueryKey()

  const addMutation = useMutation({
    ...addFavoriteMutation(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<Array<number | string>>(queryKey, (old) => [
        ...(old ?? []),
        variables.path.catalogItemId,
      ])
    },
    onError: () => queryClient.invalidateQueries({ queryKey }),
  })

  const removeMutation = useMutation({
    ...removeFavoriteMutation(),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<Array<number | string>>(queryKey, (old) =>
        (old ?? []).filter(
          (id) => Number(id) !== variables.path.catalogItemId
        )
      )
    },
    onError: () => queryClient.invalidateQueries({ queryKey }),
  })

  const toggle = (itemId: number) => {
    if (!auth.isAuthenticated) return
    if (favorites.has(itemId)) {
      removeMutation.mutate({ path: { catalogItemId: itemId } })
    } else {
      addMutation.mutate({ path: { catalogItemId: itemId } })
    }
  }

  return { favorites, toggle, canToggle: auth.isAuthenticated }
}
