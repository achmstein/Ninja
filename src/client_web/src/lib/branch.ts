import { useQuery } from '@tanstack/react-query'
import { type BranchResponse } from '@/api/tenant'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'

// Branch helpers mirroring the mobile app's Branch model
// (client_app/lib/core/models/branch.dart)

export function dayStartHour(branch?: BranchResponse | null): number {
  const parsed = parseInt(branch?.dayStartTime?.split(':')[0] ?? '')
  return Number.isNaN(parsed) ? 17 : parsed
}

export function useBranches() {
  return useQuery({
    ...getBranchesOptions(),
    staleTime: 5 * 60_000,
  })
}

/** The currently selected branch (settings drive ordering/reservation gates) */
export function useSelectedBranch(): BranchResponse | undefined {
  const branchId = useBranchStore((s) => s.branchId)
  const { data: branches = [] } = useBranches()
  return branches.find((b) => Number(b.id) === branchId) ?? branches[0]
}

/** What a customer can tell of a branch right now: open, open but not taking orders, or closed */
export type BranchState = 'open' | 'notOrdering' | 'closed'

export function branchState(branch: BranchResponse): BranchState {
  if (!branch.isActive) return 'closed'
  return branch.isOrderingEnabled ? 'open' : 'notOrdering'
}

/**
 * The branches in the order a customer meets them without a position: the
 * one they used last (the selected one) first, then the owner's order.
 */
export function lastUsedFirst(branches: BranchResponse[], branchId: number): BranchResponse[] {
  return [...branches].sort((a, b) => {
    const aOn = Number(a.id) === branchId
    const bOn = Number(b.id) === branchId
    if (aOn !== bOn) return aOn ? -1 : 1
    return Number(a.displayOrder ?? 0) - Number(b.displayOrder ?? 0)
  })
}
