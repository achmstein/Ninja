import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { getBranchesOptions } from '@/api/tenant/@tanstack/react-query.gen'
import { getBranchClaim, isOwner } from '@/config/oidc-config'

/**
 * The branches this account may work in: the public branch list narrowed to
 * the `branches` claim in the token. Owners hold every branch; a non-owner
 * with no claim gets none, which the BranchGate turns into a blocking state.
 */
export function useAllowedBranches() {
  const auth = useAuth()
  const { data: branches = [], isLoading } = useQuery(getBranchesOptions())
  const owner = isOwner(auth.user)
  // A stable key: the claim reader returns a fresh array every render
  const claimKey = getBranchClaim(auth.user).join(',')

  const allowed = useMemo(() => {
    if (owner) return branches
    const ids = new Set(claimKey ? claimKey.split(',').map(Number) : [])
    return branches.filter((b) => ids.has(Number(b.id)))
  }, [branches, owner, claimKey])

  return { branches: allowed, isLoading, isOwner: owner }
}
