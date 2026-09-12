import { getRealmRoles } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { ErrorState } from '@/components/error-state'

// Wraps Owner-only pages. The sidebar also hides their links for admins,
// but the route itself must not rely on that.
export function OwnerGate({ children }: { children: React.ReactNode }) {
  const t = useT()
  const auth = useAuth()
  const isOwner = getRealmRoles(auth.user).includes('Owner')

  if (!isOwner) {
    return (
      <ErrorState
        size='page'
        code={403}
        title={t('ownerAccessRequired')}
        description={t('ownerAccessDescription')}
        home
      />
    )
  }

  return <>{children}</>
}
