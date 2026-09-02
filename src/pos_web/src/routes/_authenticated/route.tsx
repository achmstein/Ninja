import {
  createFileRoute,
  Navigate,
  Outlet,
  useLocation,
} from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRealmRoles } from '@/config/oidc-config'
import { PosHeader } from '@/components/layout/pos-header'
import { usePosNotifications } from '@/hooks/use-pos-notifications'
import { useT } from '@/lib/i18n'

// Everything the till calls is covered by the backend's "Pos" policy
// (Admin | Owner | Cashier); this gate mirrors it. Owner-only actions
// (voiding a ticket) check the role again where they render.
const ALLOWED_ROLES = ['Admin', 'Owner', 'Cashier']

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedLayout() {
  // One SignalR connection per signed-in session
  usePosNotifications()
  return (
    <div className='flex min-h-svh flex-col'>
      <PosHeader />
      <main className='flex-1'>
        <Outlet />
      </main>
    </div>
  )
}

function AuthenticatedRoute() {
  const t = useT()
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
        <h1 className='text-2xl font-bold'>{t('accessDeniedTitle')}</h1>
        <p className='text-muted-foreground'>{t('accessDeniedDescription')}</p>
        <Button
          variant='outline'
          size='lg'
          onClick={() => auth.signoutRedirect()}
        >
          {t('signOut')}
        </Button>
      </div>
    )
  }

  return <AuthenticatedLayout />
}
