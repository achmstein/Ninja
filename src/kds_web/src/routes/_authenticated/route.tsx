import { useEffect, useRef } from 'react'
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { useAuth } from 'react-oidc-context'
import { Lock } from 'lucide-react'
import { BootSplash } from '@/components/boot-splash'
import { Button } from '@/components/ui/button'
import { BranchGate } from '@/components/branch-gate'
import { getRealmRoles } from '@/config/oidc-config'
import { KitchenHeader } from '@/components/layout/kitchen-header'
import { useKitchenNotifications } from '@/hooks/use-kitchen-notifications'
import { useWakeLock } from '@/hooks/use-wake-lock'
import { useT } from '@/lib/i18n'
import { useFeatures } from '@/lib/brand'
import { BrandMark } from '@/components/brand-mark'

// Everything the kitchen calls is covered by the backend's "Pos" policy
// (Admin | Owner | Cashier); this gate mirrors it. A kitchen screen signs
// in with a cashier account.
// A kitchen display may sign in with its own Kitchen account, or a cashier's
const ALLOWED_ROLES = ['Admin', 'Owner', 'Cashier', 'Kitchen']

export const Route = createFileRoute('/_authenticated')({
  component: AuthenticatedRoute,
})

function AuthenticatedLayout() {
  const t = useT()
  const features = useFeatures()
  // One SignalR connection per signed-in session, and a screen that stays on
  useKitchenNotifications()
  useWakeLock()
  // The kitchen display is a module of the plan: without it there is nothing to show but that
  if (!features.kds) {
    return (
      <div className='flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center'>
        <BrandMark className='size-14 text-2xl' />
        <div className='flex items-center gap-2 text-lg font-semibold'>
          <Lock className='size-5' />
          {t('kdsNotInPlan')}
        </div>
        <p className='text-muted-foreground max-w-md text-sm'>{t('kdsNotInPlanNote')}</p>
      </div>
    )
  }
  return (
    <div className='flex min-h-svh flex-col'>
      <KitchenHeader />
      <main className='flex-1'>
        <BranchGate>
          <Outlet />
        </BranchGate>
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
    return <BootSplash />
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
