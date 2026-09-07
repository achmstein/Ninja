import { useEffect } from 'react'
import { useAuth } from 'react-oidc-context'
import { Loader2, Store } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAllowedBranches } from '@/hooks/use-allowed-branches'
import { useBranchStore } from '@/stores/branch-store'
import { useT } from '@/lib/i18n'

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

  if (isLoading) return <Spinner />
  if (allowedIds.length === 0) {
    // An owner of a café with no active branches just sees empty pages
    return isOwner ? <>{children}</> : <NoBranch />
  }
  if (branchId === null || !allowedIds.includes(branchId)) return <Spinner />
  return <>{children}</>
}

function Spinner() {
  return (
    <div className='flex flex-1 items-center justify-center py-24'>
      <Loader2 className='h-8 w-8 animate-spin' />
    </div>
  )
}

function NoBranch() {
  const t = useT()
  const auth = useAuth()
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-4 p-6 py-24 text-center'>
      <Store className='text-muted-foreground size-12' />
      <h1 className='text-2xl font-bold'>{t('noBranchTitle')}</h1>
      <p className='text-muted-foreground max-w-md'>{t('noBranchDescription')}</p>
      <Button variant='outline' size='lg' onClick={() => auth.signoutRedirect()}>
        {t('signOut')}
      </Button>
    </div>
  )
}
