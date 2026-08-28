import { useQuery } from '@tanstack/react-query'
import { type BranchResponse } from '@/api/branch'
import { getBranchesOptions } from '@/api/branch/@tanstack/react-query.gen'
import { useBranchStore } from '@/stores/branch-store'

// Branch helpers mirroring the mobile app's Branch model
// (client_app/lib/core/models/branch.dart)

export function dayStartHour(branch?: BranchResponse | null): number {
  const parsed = parseInt(branch?.dayStartTime?.split(':')[0] ?? '')
  return Number.isNaN(parsed) ? 17 : parsed
}

export function dayEndHour(branch?: BranchResponse | null): number {
  const parsed = parseInt(branch?.dayEndTime?.split(':')[0] ?? '')
  return Number.isNaN(parsed) ? 5 : parsed
}

/** Whether the business day crosses midnight (e.g. 17:00 → 05:00) */
export function isOvernightShift(branch?: BranchResponse | null): boolean {
  return dayEndHour(branch) < dayStartHour(branch)
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
