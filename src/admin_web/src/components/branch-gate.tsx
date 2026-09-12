import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { useBranchStore } from '@/stores/branch-store'
import { useT } from '@/lib/i18n'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/error-state'

/**
 * Sits between the role gate and the pages. Narrows the active branch to
 * what the token allows and holds the pages back until the store agrees,
 * so no query fires with a stale or missing X-Branch-Id. A non-owner with
 * no branch sees why, and a way out.
 */
export function BranchGate({ children }: { children: React.ReactNode }) {
  const { branches, isLoading, isOwner } = useAllowedBranches()
  const branchId = useBranchStore((s) => s.branchId)
  const reconcile = useBranchStore((s) => s.reconcile)
  const allowedKey = branches.map((b) => Number(b.id)).join(',')
  const allowedIds = allowedKey ? allowedKey.split(',').map(Number) : []

  useEffect(() => {
    if (!isLoading) reconcile(allowedIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, allowedKey, reconcile])

  if (isLoading) return <Loading />
  if (allowedIds.length === 0) {
    // An owner of a café with no active branches just sees empty pages
    return isOwner ? <>{children}</> : <NoBranch />
  }
  if (branchId === null || !allowedIds.includes(branchId)) return <Loading />
  return <>{children}</>
}

function Loading() {
  return (
    <div className='flex flex-1 items-center justify-center py-24'>
      <Spinner className='size-8' />
    </div>
  )
}

function NoBranch() {
  const t = useT()
  const auth = useAuth()
  return (
    <ErrorState
      size='page'
      title={t('noBranchTitle')}
      description={t('noBranchDescription')}
      actions={
        <Button variant='outline' onClick={() => auth.signoutRedirect()}>
          {t('signOut')}
        </Button>
      }
    />
  )
}
