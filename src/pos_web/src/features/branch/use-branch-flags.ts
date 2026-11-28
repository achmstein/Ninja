import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listPlacesOptions } from '@ninja/api/spaces/@tanstack/react-query.gen'
import { getBranchesOptions, updateBranchSettingsMutation } from '@ninja/api/tenant/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'
import { useFeatures } from '@/lib/brand'
import { handleServerError } from '@/lib/handle-server-error'

/**
 * The branch's two customer-facing switches, taking orders and taking
 * reservations, read off the branch list and flipped through Tenant.API.
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
  // A branch takes reservations only when the business has them and the
  // branch has a place that can be reserved; otherwise its switch is not
  // shown, so it never reads as paused
  const hasModule = useFeatures().reservations
  const { data: places = [] } = useQuery({ ...listPlacesOptions(), enabled: hasModule })
  const reservations = hasModule && places.some((p) => p.isActive !== false && p.canReserve !== false)
  const takingReservations = branch?.isReservationsEnabled ?? true

  // Nothing to flip until a branch is active
  const flip = (body: { isOrderingEnabled?: boolean; isReservationsEnabled?: boolean }) => {
    if (branchId === null) return
    update.mutate({ path: { branchId }, body })
  }

  return {
    /** Undefined until the branch list has loaded. */
    branch,
    takingOrders,
    takingReservations,
    /** Whether this branch can be reserved at all (the module, and a place that takes reservations). */
    reservations,
    /** Either switch is off — the store is not fully trading. */
    paused: !!branch && !(takingOrders && (takingReservations || !reservations)),
    isPending: update.isPending,
    setTakingOrders: (on: boolean) => flip({ isOrderingEnabled: on }),
    setTakingReservations: (on: boolean) => flip({ isReservationsEnabled: on }),
  }
}
