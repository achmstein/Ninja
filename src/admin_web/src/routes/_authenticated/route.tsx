import { createFileRoute, Navigate, useLocation } from '@tanstack/react-router'
import { getRealmRoles } from '@/config/oidc-config'
import { useAuth } from 'react-oidc-context'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { ErrorState } from '@/components/error-state'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

const ALLOWED_ROLES = ['Admin', 'Owner']

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  const t = useT()
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return (
      <div className='flex h-svh items-center justify-center'>
        <Spinner className='size-8' />
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <Navigate to='/sign-in' search={{ redirect: location.href }} replace />
    )
  }

  const roles = getRealmRoles(auth.user)
  if (!ALLOWED_ROLES.some((role) => roles.includes(role))) {
    return (
      <ErrorState
        size='screen'
        code={403}
        title={t('accessDenied')}
        description={t('accessDeniedDescription')}
        actions={
          <Button variant='outline' onClick={() => auth.signoutRedirect()}>
            {t('signOut')}
          </Button>
        }
      />
    )
  }

  return <AuthenticatedLayout />
}
