import { type QueryClient } from '@tanstack/react-query'

/**
 * The riders' list asked again now and once more a moment later: a new or
 * renamed rider reaches Ordering, which keeps the list, as an event after
 * the login is saved
 */
export function refreshRiders(queryClient: QueryClient) {
  const again = () =>
    queryClient.invalidateQueries({ queryKey: [{ _id: 'getRidersOverview' }] })
  void again()
  setTimeout(() => void again(), 2000)
}
