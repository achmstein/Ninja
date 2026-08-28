import { useAuth } from 'react-oidc-context'
import { ShieldAlert } from 'lucide-react'
import { getRealmRoles } from '@/config/oidc-config'

// Wraps Owner-only pages. The sidebar also hides their links for admins,
// but the route itself must not rely on that.
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  if (!isOwner) {
    return (
      <div className='flex h-[60svh] flex-col items-center justify-center gap-2 text-center'>
        <ShieldAlert className='text-muted-foreground h-10 w-10' />
        <h2 className='text-xl font-bold'>Owner access required</h2>
        <p className='text-muted-foreground'>
          This page is only available to owner accounts.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
