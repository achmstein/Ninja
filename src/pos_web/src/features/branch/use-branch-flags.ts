import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getBranchesOptions,
  updateBranchSettingsMutation,
} from '@/api/branch/@tanstack/react-query.gen'
import { handleServerError } from '@/lib/handle-server-error'
import { useBranchStore } from '@/stores/branch-store'

/**
 * The branch's two customer-facing switches, taking orders and taking
 * reservations, read off the branch list and flipped through Branch.API.
 * The shift drives them automatically (open → both on, close → both off);
 * flipping one by hand is the mid-day pause — the kitchen is swamped, a
 * room is being cleaned. Ordering and Spaces enforce them server-side for
 * customers while the till itself is never blocked. The hub's
 * BranchSettingsChanged nudge refetches the list, so every till agrees.
 */
export function useBranchFlags() {
  const queryClient = useQueryClient()
  const { branchId } = useBranchStore()
  const { data: branches = [] } = useQuery(getBranchesOptions())
  const branch = branches.find((b) => Number(b.id) === branchId)

  const update = useMutation({
    ...updateBranchSettingsMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [{ _id: 'getBranches' }] })
    },
    onError: handleServerError,
  })

  const takingOrders = branch?.isOrderingEnabled ?? true
  const takingReservations = branch?.isReservationsEnabled ?? true

  return {
    /** Undefined until the branch list has loaded. */
    branch,
    takingOrders,
    takingReservations,
    /** Either switch is off — the store is not fully trading. */
    paused: !!branch && !(takingOrders && takingReservations),
    isPending: update.isPending,
    setTakingOrders: (on: boolean) =>
      update.mutate({ path: { id: branchId }, body: { isOrderingEnabled: on } }),
    setTakingReservations: (on: boolean) =>
      update.mutate({
        path: { id: branchId },
        body: { isReservationsEnabled: on },
      }),
  }
}
