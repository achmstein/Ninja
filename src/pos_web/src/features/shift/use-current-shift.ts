import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { getCurrentShiftOptions } from '@/api/sales/@tanstack/react-query.gen'
import type { ShiftView } from '@/api/sales/types.gen'
import { API_VERSION } from '@/lib/api-client'
import { getActiveBranchId } from '@/stores/branch-store'
import { rememberOpenShift } from './last-open-shift'

/**
 * The branch's open drawer shift. A 404 is the server's normal "no shift
 * open" answer, so it is surfaced as `noShift` instead of an error toast
 * and never retried. Everything shift-related shares this one query, so a
 * single invalidation after open/close updates the header chip, the floor
 * button, and the shift screen together.
 */
export function useCurrentShift(options?: { refetchInterval?: number }) {
  const query = useQuery({
    ...getCurrentShiftOptions({ query: { 'api-version': API_VERSION } }),
    retry: (failureCount, error) => {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return false
      }
      return failureCount < 3
    },
    refetchInterval: options?.refetchInterval,
  })

  const noShift =
    query.isError &&
    query.error instanceof AxiosError &&
    query.error.response?.status === 404

  // Remembered for a sale rung up offline: it is credited to this drawer
  const data = query.data as ShiftView | undefined
  const openId =
    !query.isError && data?.status === 'Open' && data.id != null ? Number(data.id) : null
  const openBranch = data?.branchId != null ? Number(data.branchId) : null
  useEffect(() => {
    if (openId != null && openBranch != null) rememberOpenShift(openBranch, openId)
  }, [openId, openBranch])
  useEffect(() => {
    const branchId = getActiveBranchId()
    if (noShift && branchId != null) rememberOpenShift(branchId, null)
  }, [noShift])

  return {
    // The error wins over retained data: a refetch that comes back 404 keeps
    // the last shift in the cache, and that is not the shift that is open
    shift: query.isError ? null : ((query.data ?? null) as ShiftView | null),
    /** True once the server has said "no shift open" (vs. still loading). */
    noShift,
    isLoading: query.isLoading,
  }
}
