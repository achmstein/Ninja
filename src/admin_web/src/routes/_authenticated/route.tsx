import { createFileRoute, Navigate, useLocation } from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRealmRoles } from '@/config/oidc-config'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

const ALLOWED_ROLES = ['Admin', 'Owner']

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return (
      <div className='flex h-svh items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin' />
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
      <div className='flex h-svh flex-col items-center justify-center gap-4'>
        <h1 className='text-2xl font-bold'>Access denied</h1>
        <p className='text-muted-foreground'>
          Your account does not have access to the admin panel.
        </p>
        <Button variant='outline' onClick={() => auth.signoutRedirect()}>
          Sign out
        </Button>
      </div>
    )
  }

  return <AuthenticatedLayout />
}
