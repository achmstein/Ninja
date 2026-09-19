import { useEffect, useRef } from 'react'
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getRealmRoles } from '@/config/oidc-config'
import { AppHeader } from '@/components/layout/app-header'
import { useT } from '@/lib/i18n'

// Everything the control panel calls is covered by Control.API's "Platform"
// policy; this gate mirrors it.
const ALLOWED_ROLES = ['PlatformAdmin']

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedLayout() {
  return (
    <div className='flex min-h-svh flex-col'>
      <AppHeader />
      <main className='mx-auto w-full max-w-6xl flex-1 px-4 py-6'>
        <Outlet />
      </main>
    </div>
  )
}

function AuthenticatedRoute() {
  const t = useT()
  const auth = useAuth()
  const router = useRouter()
  const navigate = useNavigate()
  const sentToSignIn = useRef(false)

  const needsSignIn = !auth.isLoading && !auth.isAuthenticated

  // Hand off to Keycloak exactly once. Rendering <Navigate> here instead
  // re-fires on every render (it compares its props by identity, and JSX
  // hands it a fresh object each time), and this gate stays mounted while
  // the /sign-in transition is still in flight — so every pass folded the
  // half-applied URL back into `redirect`, growing it each round until the
  // tab locked up. Reading the location inside the effect keeps the
  // come-back-to URL current without ever feeding it back.
  useEffect(() => {
    if (!needsSignIn || sentToSignIn.current) return
    sentToSignIn.current = true
    navigate({
      to: '/sign-in',
      search: { redirect: router.state.location.href },
      replace: true,
    })
  }, [needsSignIn, navigate, router])

  if (auth.isLoading || needsSignIn) {
    return (
      <div className='flex h-svh items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin' />
      </div>
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
