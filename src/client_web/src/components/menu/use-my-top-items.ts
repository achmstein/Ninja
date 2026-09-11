import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { apiClient } from '@/lib/api-client'

// The signed-in customer's most-frequently-ordered item ids, ranked. Anonymous
// visitors get an empty list, so the "your usuals" section simply doesn't show.
export function useMyTopItems() {
  const auth = useAuth()
  const { data: ids = [] } = useQuery({
    queryKey: ['myTopItems'],
    queryFn: async () => {
      const response = await apiClient.get<number[]>('/api/catalog/top-items')
      return response.data
    },
    enabled: auth.isAuthenticated,
    staleTime: 60_000,
  })
  return ids
}
