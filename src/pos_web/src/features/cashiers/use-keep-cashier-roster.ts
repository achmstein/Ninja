import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useBranchStore } from '@/stores/branch-store'
import { apiClient } from '@/lib/api-client'
import { cashiersOf, ROSTER_KEY, type StaffUser } from './roster'

const TILL_ROLES = 'Admin,Owner,Cashier'

/** Keeps the roster current while somebody is signed in. Mount once, inside the signed-in till. */
export function useKeepCashierRoster() {
  const branchId = useBranchStore((s) => s.branchId)
  const { data } = useQuery({
    queryKey: ['tillStaff'],
    queryFn: async () => {
      const response = await apiClient.get<StaffUser[]>('/api/identity/users', {
        params: { role: TILL_ROLES, enabled: true, max: 200 },
      })
      return response.data
    },
    staleTime: 10 * 60_000,
  })
  useEffect(() => {
    if (!data) return
    try {
      localStorage.setItem(ROSTER_KEY, JSON.stringify(cashiersOf(data, branchId)))
    } catch {
      // No storage: the signed-out screen offers the plain sign-in only
    }
  }, [data, branchId])
}
